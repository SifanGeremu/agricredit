/**
 * M-Pesa sandbox integration — for demos / hackathon only (per Safaricom collection guidance).
 * Not production; live credentials, compliance, and callbacks must be handled separately.
 */
import { prisma } from '../lib/prisma.js';
import { TransactionType, TransactionStatus } from '../lib/db.js';
import crypto from 'crypto';

const DEFAULT_BASE = 'https://apisandbox.safaricom.et';

function genReference(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/** Strip to digits only — use full international MSISDN (e.g. 251… or 254…) in sandbox. */
function normalizeMsisdn(phone) {
  return String(phone).replace(/\D/g, '');
}

function isEthiopiaStyleBase(base) {
  return /safaricom\.et/i.test(base);
}

/**
 * Resolve endpoints: Ethiopia sandbox (Postman: apisandbox.safaricom.et) vs Kenya Daraja.
 */
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

async function logTransaction({ type, phone, amount, status, reference }) {
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
 * OAuth access token (Basic auth). Ethiopia: /v1/token/generate — Kenya: /oauth/v1/generate
 */
async function getMpesaAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) return null;
  const { tokenUrl } = mpesaEndpoints();
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
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

/**
 * B2C disbursement to vendor wallet MSISDN. Ethiopia v2 expects OriginatorConversationID + Occassion (API spelling).
 */
export async function disburseToVendor(phone, amount) {
  const reference = genReference('DISB');
  const msisdn = normalizeMsisdn(phone);
  let apiOk = false;
  let apiDetail = '';

  try {
    const token = await getMpesaAccessToken();
    const shortcode = process.env.MPESA_SHORTCODE;
    const initiator = process.env.MPESA_INITIATOR_NAME;
    const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL;

    if (token && shortcode && initiator && securityCredential && msisdn) {
      const { b2cUrl, et } = mpesaEndpoints();
      const cb = callbackUrls();
      const payload = et
        ? {
            OriginatorConversationID: `AgriCredit-${crypto.randomUUID()}`,
            InitiatorName: initiator,
            SecurityCredential: securityCredential,
            CommandID: 'BusinessPayment',
            PartyA: shortcode,
            PartyB: msisdn,
            Amount: Math.floor(amount),
            Remarks: 'AgriCredit vendor disbursement',
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
            Remarks: 'AgriCredit vendor disbursement',
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
      apiOk = probe.ok;
      if (!probe.ok) {
        const t = await probe.text();
        apiDetail = t.slice(0, 200);
      }
    }
  } catch {
    apiOk = false;
  }

  const status = TransactionStatus.success;
  await logTransaction({
    type: TransactionType.disburse,
    phone: msisdn || phone,
    amount,
    status,
    reference,
  });

  return {
    success: true,
    reference,
    simulated: !apiOk,
    message: apiOk
      ? 'M-Pesa B2C request accepted (confirm final status via ResultURL callback).'
      : apiDetail
        ? `Sandbox call failed — simulated success. Hint: ${apiDetail}`
        : 'M-Pesa not fully configured or call failed — simulated success for demo.',
  };
}

/**
 * STK push (repayment). Ethiopia v3 includes MerchantRequestID; Kenya v1 does not.
 */
export async function receiveRepayment(phone, amount) {
  const reference = genReference('REPAY');
  const msisdn = normalizeMsisdn(phone);
  let apiOk = false;
  let apiDetail = '';

  try {
    const token = await getMpesaAccessToken();
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    if (token && shortcode && passkey && msisdn) {
      const { stkUrl, et } = mpesaEndpoints();
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(0, 14);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
        'base64',
      );
      const cb = callbackUrls();

      const payload = et
        ? {
            MerchantRequestID: `AgriCredit-${crypto.randomUUID()}`,
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.floor(amount),
            PartyA: msisdn,
            PartyB: shortcode,
            PhoneNumber: msisdn,
            CallBackURL: cb.stk,
            AccountReference: 'AgriCredit',
            TransactionDesc: 'Loan repayment',
          }
        : {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.floor(amount),
            PartyA: msisdn,
            PartyB: shortcode,
            PhoneNumber: msisdn,
            CallBackURL: cb.stk,
            AccountReference: 'AgriCredit',
            TransactionDesc: 'Loan repayment',
          };

      const stk = await fetch(stkUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      apiOk = stk.ok;
      if (!stk.ok) {
        const t = await stk.text();
        apiDetail = t.slice(0, 200);
      }
    }
  } catch {
    apiOk = false;
  }

  const status = TransactionStatus.success;
  await logTransaction({
    type: TransactionType.repay,
    phone: msisdn || phone,
    amount,
    status,
    reference,
  });

  return {
    success: true,
    reference,
    simulated: !apiOk,
    message: apiOk
      ? 'STK push initiated (confirm on phone; callback hits CallBackURL).'
      : apiDetail
        ? `STK failed — simulated success. Hint: ${apiDetail}`
        : 'M-Pesa STK not configured or call failed — simulated success for demo.',
  };
}
