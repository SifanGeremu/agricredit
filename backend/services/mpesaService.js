/**
 * M-Pesa — Ethiopia apisandbox.safaricom.et (STK v3, B2C v2) or Kenya Daraja when MPESA_BASE_URL is .co.ke.
 * STK Password: Base64( BusinessShortCode + Passkey + Timestamp ); passkey = plain Lipa Na M-Pesa passkey from portal.
 * By default, failed STK/B2C does not record repayment/disburse (set MPESA_ALLOW_SIMULATED_FALLBACK=true for demo fallback only).
 */
import { prisma } from '../lib/prisma.js';
import { TransactionType, TransactionStatus } from '../lib/db.js';
import crypto from 'crypto';

const DEFAULT_BASE = 'https://apisandbox.safaricom.et';

function genReference(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/** Lipa Na M-Pesa Online AccountReference max length (match Postman / Daraja). */
function stkAccountReferenceValue() {
  return crypto.randomBytes(6).toString('hex');
}

/** If false (default), STK/B2C must succeed or the API returns an error — no fake repayment/disburse. */
function mpesaAllowSimulatedFallback() {
  return process.env.MPESA_ALLOW_SIMULATED_FALLBACK === 'true';
}

/** Strip to digits only — full international MSISDN (251… / 254…). */
function normalizeMsisdn(phone) {
  return String(phone).replace(/\D/g, '');
}

function isEthiopiaStyleBase(base) {
  return /safaricom\.et/i.test(base);
}

/** YYYYMMDDHHmmss in East Africa Time (same as Kenya/Ethiopia business time for Safaricom APIs). */
function mpesaTimestampEAT() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value ?? '00';
  const y = g('year');
  const mo = g('month');
  const d = g('day');
  const h = g('hour');
  const mi = g('minute');
  const s = g('second');
  return `${y}${mo}${d}${h}${mi}${s}`;
}

function mpesaEndpoints() {
  const base = (process.env.MPESA_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const et = isEthiopiaStyleBase(base);
  return {
    base,
    et,
    tokenUrl: et
      ? `${base}/v1/token/generate?grant_type=client_credentials`
      : `${base}/oauth/v1/generate?grant_type=client_credentials`,
    b2cUrl: et
      ? `${base}/mpesa/b2c/v2/paymentrequest`
      : `${base}/mpesa/b2c/v1/paymentrequest`,
    stkUrl: et
      ? `${base}/mpesa/stkpush/v3/processrequest`
      : `${base}/mpesa/stkpush/v1/processrequest`,
  };
}

export async function logTransaction({ type, phone, amount, status, reference }) {
  return prisma.transaction.create({
    data: {
      type,
      phone,
      amount,
      status,
      reference,
    },
  });
}

/**
 * Same as Postman "Generate Token": Basic auth = consumer key : consumer secret.
 * @returns {{ token: string | null, error: string | null }}
 */
async function fetchMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) {
    return {
      token: null,
      error: 'Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET.',
    };
  }
  const { tokenUrl } = mpesaEndpoints();
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      token: null,
      error: `OAuth token failed (HTTP ${res.status}): ${text.slice(0, 400)}`,
    };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { token: null, error: 'Token response was not valid JSON.' };
  }
  const token = data.access_token;
  if (!token) {
    return { token: null, error: 'Token response missing access_token.' };
  }
  return { token, error: null };
}

/** Ethiopia STK (Postman mpesa-developers-api C2B): ReferenceData uses Key / Value (PascalCase). */
function ethiopiaStkReferenceData() {
  const raw = process.env.MPESA_STK_REFERENCE_DATA;
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j) && j.length) return j;
    } catch {
      /* fall through */
    }
  }
  const cashier = process.env.MPESA_STK_CASHIER_NAME || 'Cha cha';
  return [{ Key: 'CashierName', Value: cashier }];
}

function callbackUrls() {
  const fallback = 'https://example.com/mpesa-callback';
  const u = process.env.MPESA_CALLBACK_URL || fallback;
  return {
    result: process.env.MPESA_RESULT_URL || u,
    queue: process.env.MPESA_QUEUE_TIMEOUT_URL || u,
    stk: process.env.MPESA_STK_CALLBACK_URL || u,
  };
}

/** STK processRequest: only ResponseCode "0" means push accepted (not payment completed). */
function stkBodyIndicatesSuccess(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  const rc = parsed.ResponseCode ?? parsed.responseCode;
  return rc === '0' || rc === 0;
}

function pickStkFields(parsed) {
  if (!parsed || typeof parsed !== 'object') return {};
  return {
    responseCode: parsed.ResponseCode ?? parsed.responseCode ?? null,
    customerMessage:
      parsed.CustomerMessage ??
      parsed.customerMessage ??
      parsed.errorMessage ??
      parsed.ErrorMessage ??
      null,
    checkoutRequestId: parsed.CheckoutRequestID ?? parsed.checkoutRequestID ?? null,
    merchantRequestId: parsed.MerchantRequestID ?? parsed.merchantRequestID ?? null,
    resultDesc: parsed.ResultDesc ?? parsed.resultDesc ?? null,
  };
}

export async function disburseToVendor(phone, amount) {
  const reference = genReference('DISB');
  const msisdn = normalizeMsisdn(phone);
  let apiOk = false;
  let apiDetail = '';
  let parsed = null;

  let tokenError = null;
  try {
    const { token, error: tokErr } = await fetchMpesaToken();
    tokenError = tokErr;
    const shortcode = process.env.MPESA_SHORTCODE;
    const initiator = process.env.MPESA_INITIATOR_NAME;
    const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL;

    if (token && shortcode && initiator && securityCredential && msisdn) {
      const { b2cUrl, et } = mpesaEndpoints();
      const cb = callbackUrls();
      const b2cOriginPrefix =
        process.env.MPESA_B2C_ORIGINATOR_PREFIX || 'AgriCredit';
      const payload = et
        ? {
            OriginatorConversationID: `${b2cOriginPrefix}-${crypto.randomUUID()}`,
            InitiatorName: initiator,
            SecurityCredential: securityCredential,
            CommandID: 'BusinessPayment',
            PartyA: shortcode,
            PartyB: msisdn,
            Amount: Math.floor(amount),
            Remarks:
              process.env.MPESA_B2C_REMARKS || 'AgriCredit vendor disbursement',
            Occassion: reference,
            QueueTimeOutURL: cb.queue,
            ResultURL: cb.result,
          }
        : {
            InitiatorName: initiator,
            SecurityCredential: securityCredential,
            CommandID: 'BusinessPayment',
            PartyA: shortcode,
            PartyB: msisdn,
            Amount: Math.floor(amount),
            Remarks:
              process.env.MPESA_B2C_REMARKS || 'AgriCredit vendor disbursement',
            QueueTimeOutURL: cb.queue,
            ResultURL: cb.result,
            Occasion: reference,
          };

      const probe = await fetch(b2cUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await probe.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        apiDetail = text.slice(0, 300);
      }
      if (parsed) {
        const rc = parsed.ResponseCode ?? parsed.responseCode;
        apiOk = probe.ok && (rc === '0' || rc === 0 || parsed.ConversationID);
      } else {
        apiOk = probe.ok;
      }
      if (!apiOk && !apiDetail && text) apiDetail = text.slice(0, 300);
    } else {
      if (tokenError) apiDetail = tokenError;
      else if (!token)
        apiDetail =
          'OAuth token failed — set MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET (Postman Generate Token Basic auth).';
      else if (!shortcode || !initiator || !securityCredential)
        apiDetail =
          'Missing MPESA_SHORTCODE, MPESA_INITIATOR_NAME, or MPESA_SECURITY_CREDENTIAL.';
      else if (!msisdn) apiDetail = 'Missing or invalid phone number for B2C.';
    }
  } catch (e) {
    apiOk = false;
    apiDetail = e.message || String(e);
  }

  const allowFallback = mpesaAllowSimulatedFallback();

  if (!apiOk && !allowFallback) {
    await logTransaction({
      type: TransactionType.disburse,
      phone: msisdn || phone,
      amount,
      status: TransactionStatus.failed,
      reference,
    });
    return {
      ok: false,
      reference,
      simulated: false,
      mpesaAccepted: false,
      customerMessage: parsed?.CustomerMessage ?? parsed?.ResponseDescription ?? null,
      responseCode: parsed?.ResponseCode ?? null,
      message:
        apiDetail ||
        'M-Pesa B2C was not accepted. Fix credentials and try again.',
    };
  }

  await logTransaction({
    type: TransactionType.disburse,
    phone: msisdn || phone,
    amount,
    status: TransactionStatus.success,
    reference,
  });

  return {
    ok: true,
    reference,
    simulated: !apiOk && allowFallback,
    mpesaAccepted: apiOk,
    customerMessage: parsed?.CustomerMessage ?? parsed?.ResponseDescription ?? null,
    responseCode: parsed?.ResponseCode ?? null,
    message: apiOk
      ? parsed?.CustomerMessage ||
        'M-Pesa B2C accepted. Confirm final status on ResultURL callback.'
      : apiDetail
        ? `Demo only: B2C did not confirm from Safaricom. ${apiDetail}`
        : 'M-Pesa B2C not accepted (demo fallback).',
  };
}

/**
 * STK Push — repayment. Uses EAT timestamp for Password; optional MPESA_STK_MSISDN for test handset.
 * Returns stkAccountRef (12-char id sent as AccountReference) for callback correlation — see Postman C2B body.
 */
export async function receiveRepayment(phone, amount) {
  const reference = genReference('REPAY');
  const stkAccountRef = stkAccountReferenceValue();
  const stkPhone = process.env.MPESA_STK_MSISDN || phone;
  const msisdn = normalizeMsisdn(stkPhone);
  let apiOk = false;
  let apiDetail = '';
  let parsed = null;
  let stkTimestamp = null;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  let tokenError = null;
  try {
    const { token, error: tokErr } = await fetchMpesaToken();
    tokenError = tokErr;

    if (token && shortcode && passkey && msisdn) {
      const { stkUrl, et } = mpesaEndpoints();
      stkTimestamp = mpesaTimestampEAT();
      const timestamp = stkTimestamp;
      const password = Buffer.from(`${String(shortcode)}${passkey}${timestamp}`).toString(
        'base64',
      );
      const cb = callbackUrls();
      const txDesc =
        process.env.MPESA_STK_TX_DESC || 'Fast Payment';
      const merchantPrefix =
        process.env.MPESA_STK_MERCHANT_PREFIX || 'Partner names';

      const payload = et
        ? {
            MerchantRequestID: `${merchantPrefix} -${crypto.randomUUID()}`,
            BusinessShortCode: String(shortcode),
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.floor(amount),
            PartyA: String(msisdn),
            PartyB: String(shortcode),
            PhoneNumber: String(msisdn),
            CallBackURL: cb.stk,
            AccountReference: stkAccountRef,
            TransactionDesc: txDesc,
            ReferenceData: ethiopiaStkReferenceData(),
          }
        : {
            BusinessShortCode: String(shortcode),
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.floor(amount),
            PartyA: String(msisdn),
            PartyB: String(shortcode),
            PhoneNumber: String(msisdn),
            CallBackURL: cb.stk,
            AccountReference: stkAccountRef,
            TransactionDesc: txDesc,
          };

      const stk = await fetch(stkUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await stk.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        apiDetail = text.slice(0, 400);
      }
      apiOk = stk.ok && (parsed ? stkBodyIndicatesSuccess(parsed) : false);
      if (!apiOk && parsed) {
        const fields = pickStkFields(parsed);
        apiDetail =
          fields.resultDesc ||
          fields.customerMessage ||
          `ResponseCode=${fields.responseCode}` ||
          text.slice(0, 300);
      }
      if (!apiOk && !parsed && text) apiDetail = text.slice(0, 400);
    } else {
      if (tokenError) apiDetail = tokenError;
      else if (!token)
        apiDetail =
          'OAuth token failed — set MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET (Postman Generate Token Basic auth).';
      else if (!shortcode || !passkey)
        apiDetail =
          'Missing MPESA_SHORTCODE or MPESA_PASSKEY (plain Lipa Na M-Pesa passkey from portal).';
      else apiDetail = 'Missing phone / MSISDN.';
    }
  } catch (e) {
    apiOk = false;
    apiDetail = e.message || String(e);
  }

  const stkFields = pickStkFields(parsed);
  const allowFallback = mpesaAllowSimulatedFallback();

  if (!apiOk && !allowFallback) {
    await logTransaction({
      type: TransactionType.repay,
      phone: msisdn || phone,
      amount,
      status: TransactionStatus.failed,
      reference,
    });
    return {
      ok: false,
      reference,
      stkAccountRef,
      stkInitiated: false,
      simulated: false,
      phoneUsed: msisdn,
      timestampUsed: stkTimestamp,
      responseCode: stkFields.responseCode,
      customerMessage: stkFields.customerMessage,
      checkoutRequestId: stkFields.checkoutRequestId,
      merchantRequestId: stkFields.merchantRequestId,
      message:
        apiDetail ||
        'M-Pesa STK was not accepted. Check .env (keys, passkey, MPESA_STK_MSISDN) and try again.',
    };
  }

  return {
    ok: true,
    reference,
    stkAccountRef,
    simulated: !apiOk && allowFallback,
    stkInitiated: apiOk,
    phoneUsed: msisdn,
    timestampUsed: stkTimestamp,
    responseCode: stkFields.responseCode,
    customerMessage: stkFields.customerMessage,
    checkoutRequestId: stkFields.checkoutRequestId,
    merchantRequestId: stkFields.merchantRequestId,
    message: apiOk
      ? stkFields.customerMessage ||
        'STK Push sent. Approve on your phone when prompted; callback goes to CallBackURL.'
      : apiDetail
        ? `Demo only: STK did not confirm. ${apiDetail}`
        : 'STK misconfigured (demo fallback).',
  };
}
