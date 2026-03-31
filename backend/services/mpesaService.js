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

/**
 * No real HTTP calls to Safaricom — returns Postman-shaped success JSON for demos / local testing.
 * Set MPESA_MOCK_MODE=true in backend/.env
 */
function mpesaMockMode() {
  return process.env.MPESA_MOCK_MODE === 'true';
}

/** Strip to digits only — full international MSISDN (251… / 254…). */
function normalizeMsisdn(phone) {
  return String(phone).replace(/\D/g, '');
}

/**
 * Accept passkey either as the plain portal value OR base64(passkey) (common Postman confusion).
 * If the env looks like base64 and cleanly round-trips, decode it.
 */
function normalizePasskey(passkey) {
  const raw = String(passkey || '').trim();
  if (!raw) return '';
  if (!/^[A-Za-z0-9+/=]+$/.test(raw) || raw.length % 4 !== 0) return raw;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (!decoded) return raw;
    // reject binary / control chars
    if (/[\u0000-\u001F\u007F]/.test(decoded)) return raw;
    const re = Buffer.from(decoded, 'utf8').toString('base64');
    const norm = (s) => String(s).replace(/=+$/g, '');
    return norm(re) === norm(raw) ? decoded : raw;
  } catch {
    return raw;
  }
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
  let res;
  try {
    res = await fetch(tokenUrl, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    });
  } catch (e) {
    const msg = e?.cause?.message || e?.message || String(e);
    return {
      token: null,
      error: `Network error fetching OAuth token from ${tokenUrl}: ${msg}`,
    };
  }
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

export async function probeMpesaOAuth() {
  try {
    const { token, error } = await fetchMpesaToken();
    if (!token) return { ok: false, error: error || 'OAuth token missing.' };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
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

/**
 * Optional Postman STK JSON template (Ethiopia v3 shape) — lets you reuse the exact JSON fields from
 * a Postman collection while still overriding dynamic values (Amount, PhoneNumber, etc).
 *
 * Env var should contain a JSON object with keys like:
 * MerchantRequestID, BusinessShortCode, Password, Timestamp, TransactionType, Amount, PartyA, PartyB,
 * PhoneNumber, CallBackURL, AccountReference, TransactionDesc, ReferenceData.
 */
function stkPayloadTemplateFromEnv() {
  let raw = process.env.MPESA_STK_PAYLOAD_TEMPLATE_JSON;
  if (!raw) return null;
  raw = String(raw).trim();
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    raw = raw.slice(1, -1);
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
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

/**
 * Raw STK Push forwarder — accepts a Postman-shaped payload and sends it to Safaricom STK endpoint.
 * Uses backend OAuth (MPESA_CONSUMER_KEY/SECRET) regardless of any client-provided Authorization header.
 *
 * This is intentionally "thin": it does not compute Password/Timestamp; it forwards the payload as-is.
 * Use `receiveRepayment()` if you want the backend to compute dynamic values and tie the payment to a loan.
 */
export async function stkPushFromPayload(payload) {
  let body = payload;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, message: 'Invalid STK payload (string was not valid JSON).' };
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Invalid STK payload (expected JSON object).' };
  }

  if (mpesaMockMode()) {
    const stkTimestamp = mpesaTimestampEAT();
    const checkoutId = `ws_CO_${Date.now()}${crypto.randomBytes(2).toString('hex')}`;
    const merchantReqId = `Partner names -${crypto.randomUUID()}`;
    const postmanStyleResponse = {
      MerchantRequestID: merchantReqId,
      CheckoutRequestID: checkoutId,
      ResponseCode: '0',
      ResponseDescription: 'Success',
      CustomerMessage: 'Success. Request accepted for processing',
      MerchantCode: String(process.env.MPESA_SHORTCODE || '6564'),
    };
    return {
      ok: true,
      mock: true,
      stkInitiated: true,
      simulated: false,
      timestampUsed: stkTimestamp,
      responseCode: '0',
      customerMessage: postmanStyleResponse.CustomerMessage,
      checkoutRequestId: checkoutId,
      merchantRequestId: merchantReqId,
      postmanStyleResponse,
      message: 'Mock STK — no call to Safaricom (MPESA_MOCK_MODE=true).',
    };
  }

  let apiOk = false;
  let apiDetail = '';
  let parsed = null;

  try {
    const { token, error } = await fetchMpesaToken();
    if (!token) {
      return {
        ok: false,
        stkInitiated: false,
        simulated: false,
        message: error || 'Missing OAuth token (check MPESA_CONSUMER_KEY/SECRET).',
      };
    }

    const { stkUrl } = mpesaEndpoints();
    const res = await fetch(stkUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      apiDetail = text.slice(0, 400);
    }

    apiOk = res.ok && (parsed ? stkBodyIndicatesSuccess(parsed) : false);
    if (!apiOk && parsed) {
      const fields = pickStkFields(parsed);
      apiDetail =
        fields.resultDesc ||
        fields.customerMessage ||
        `ResponseCode=${fields.responseCode}` ||
        text.slice(0, 300);
    }
    if (!apiOk && !parsed && text) apiDetail = text.slice(0, 400);
  } catch (e) {
    apiOk = false;
    apiDetail = e.message || String(e);
  }

  const stkFields = pickStkFields(parsed);
  return {
    ok: apiOk,
    stkInitiated: apiOk,
    simulated: false,
    responseCode: stkFields.responseCode,
    customerMessage: stkFields.customerMessage,
    checkoutRequestId: stkFields.checkoutRequestId,
    merchantRequestId: stkFields.merchantRequestId,
    message: apiOk
      ? stkFields.customerMessage ||
        'STK Push accepted. Approve on your phone when prompted; callback goes to CallBackURL.'
      : apiDetail || 'STK Push was not accepted.',
  };
}

export async function disburseToVendor(phone, amount) {
  const reference = genReference('DISB');
  const msisdn = normalizeMsisdn(phone);

  if (mpesaMockMode()) {
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
      mock: true,
      simulated: false,
      mpesaAccepted: true,
      responseCode: '0',
      customerMessage: 'Accept the service request successfully.',
      message: 'Mock B2C — no call to Safaricom (MPESA_MOCK_MODE=true).',
    };
  }

  let apiOk = false;
  let apiDetail = '';
  let parsed = null;

  let tokenError = null;
  try {
    const { token, error: tokErr } = await fetchMpesaToken();
    tokenError = tokErr;
    const shortcode = String(process.env.MPESA_SHORTCODE || '').trim();
    const initiator = String(process.env.MPESA_INITIATOR_NAME || '').trim();
    const securityCredential = String(process.env.MPESA_SECURITY_CREDENTIAL || '').trim();

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

      let probe;
      try {
        probe = await fetch(b2cUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        apiOk = false;
        apiDetail = `Network error calling ${b2cUrl}: ${e?.cause?.message || e?.message || String(e)}`;
        probe = null;
      }
      if (!probe) throw new Error(apiDetail);
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
 * STK Push — repayment (PartyA / PhoneNumber = normalized `phone` argument).
 * Caller should pass the number from POST /mpesa/repay `phone` or the user account phone.
 * Optional env override: MPESA_STK_USE_ENV_MSISDN=true + MPESA_STK_MSISDN (server-side tests only).
 */
export async function receiveRepayment(phone, amount) {
  const reference = genReference('REPAY');
  const stkAccountRef = stkAccountReferenceValue();
  /** Caller passes the final handset (from POST /mpesa/repay JSON or account phone). */
  const msisdn = normalizeMsisdn(phone);

  if (mpesaMockMode()) {
    const stkTimestamp = mpesaTimestampEAT();
    const checkoutId = `ws_CO_${Date.now()}${crypto.randomBytes(2).toString('hex')}`;
    const merchantReqId = `Partner names -${crypto.randomUUID()}`;
    const postmanStyleResponse = {
      MerchantRequestID: merchantReqId,
      CheckoutRequestID: checkoutId,
      ResponseCode: '0',
      ResponseDescription: 'Success',
      CustomerMessage: 'Success. Request accepted for processing',
      MerchantCode: String(process.env.MPESA_SHORTCODE || '6564'),
    };
    return {
      ok: true,
      reference,
      stkAccountRef,
      mock: true,
      stkInitiated: true,
      simulated: false,
      phoneUsed: msisdn,
      timestampUsed: stkTimestamp,
      responseCode: '0',
      customerMessage: postmanStyleResponse.CustomerMessage,
      checkoutRequestId: checkoutId,
      merchantRequestId: merchantReqId,
      postmanStyleResponse,
      message:
        'Mock STK — no call to Safaricom (MPESA_MOCK_MODE=true). Matches sandbox success JSON shape.',
    };
  }

  let apiOk = false;
  let apiDetail = '';
  let parsed = null;
  let stkTimestamp = null;
  const shortcode = String(process.env.MPESA_SHORTCODE || '').trim();
  const passkey = normalizePasskey(process.env.MPESA_PASSKEY);
  const template = stkPayloadTemplateFromEnv();

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

      // Default (no template): build the normal payload.
      let payload = et
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

      // If you paste the Postman JSON into MPESA_STK_PAYLOAD_TEMPLATE_JSON, reuse all fields from it
      // and override only the values that must be dynamic for each repayment.
      if (template && et) {
        payload = {
          ...template,
          // Always keep these aligned with current repayment request:
          Amount: Math.floor(amount),
          PartyA: String(msisdn),
          PhoneNumber: String(msisdn),
          CallBackURL: cb.stk,
          // Make AccountReference unique so the callback can finalize the correct pending repayment:
          AccountReference: stkAccountRef,
          // Prefer backend-calculated (fresh) timestamp/password unless explicitly told to keep the template values.
          ...(process.env.MPESA_STK_TEMPLATE_KEEP_PASSWORD_TIMESTAMP === 'true'
            ? {}
            : { Timestamp: timestamp, Password: password }),
          // Always prefer backend shortcode to avoid mismatches across environments:
          BusinessShortCode: String(shortcode),
          PartyB: String(shortcode),
          // Ensure ReferenceData exists for Ethiopia STK v3
          ReferenceData:
            Array.isArray(template.ReferenceData) && template.ReferenceData.length
              ? template.ReferenceData
              : ethiopiaStkReferenceData(),
          // Keep TransactionDesc sane if template omitted it
          TransactionDesc: template.TransactionDesc || txDesc,
          // Keep TransactionType sane if template omitted it
          TransactionType: template.TransactionType || 'CustomerPayBillOnline',
        };
      }

      let stk;
      try {
        stk = await fetch(stkUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        apiOk = false;
        apiDetail = `Network error calling ${stkUrl}: ${e?.cause?.message || e?.message || String(e)}`;
        stk = null;
      }
      if (!stk) throw new Error(apiDetail);
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
      else if (!msisdn)
        apiDetail =
          'Missing or invalid phone — send "phone" in /mpesa/repay JSON (sandbox MSISDN) or use your account phone.';
    }
  } catch (e) {
    apiOk = false;
    apiDetail = e?.cause?.message || e?.message || String(e);
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
        'M-Pesa STK was not accepted. Check .env (keys, passkey) and the phone in your request body (PartyA / PhoneNumber).',
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
