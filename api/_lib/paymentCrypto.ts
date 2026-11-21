import crypto from 'node:crypto';
import type {IncomingMessage, ServerResponse} from 'node:http';

const globalForSecret = globalThis as unknown as {__mcPaymentWebhookSecret?: string};

export function getWebhookSecret(): string {
  const configured = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }
  if (!globalForSecret.__mcPaymentWebhookSecret) {
    globalForSecret.__mcPaymentWebhookSecret = crypto.randomBytes(32).toString('hex');
  }
  return globalForSecret.__mcPaymentWebhookSecret;
}

export function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getWebhookSecret()).update(payload).digest('hex');
}

export function safeCompareHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export interface ApiRequest extends IncomingMessage {
  body?: unknown;
}

export interface ApiResponse extends ServerResponse {
  status?: (code: number) => ApiResponse;
  json?: (data: unknown) => void;
}

export function sendJson(res: ApiResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function readJsonBody(req: ApiRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > 256 * 1024) {
      throw new Error('Payload too large');
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function createAuthorizedOrderPayload(body: Record<string, unknown>) {
  const {userId, packageId, coins, amountInr, upiMerchantId, upiMerchantName} = body;

  if (
    typeof userId !== 'string' ||
    userId.trim().length < 3 ||
    typeof packageId !== 'string' ||
    packageId.trim().length < 1 ||
    typeof coins !== 'number' ||
    !Number.isFinite(coins) ||
    coins <= 0 ||
    coins > 1000000 ||
    typeof amountInr !== 'number' ||
    !Number.isFinite(amountInr) ||
    amountInr <= 0 ||
    amountInr > 1000000 ||
    typeof upiMerchantId !== 'string' ||
    !upiMerchantId.includes('@') ||
    typeof upiMerchantName !== 'string' ||
    upiMerchantName.trim().length < 2
  ) {
    return {
      status: 400,
      data: {error: 'Invalid authorized payment configuration or package parameters.'},
    };
  }

  if (Math.abs(coins - amountInr) > 0.01) {
    return {
      status: 400,
      data: {error: 'Coin package valuation mismatch (1 Coin must equal ₹1).'},
    };
  }

  const orderId = `MCORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiMerchantId.trim())}&pn=${encodeURIComponent(
    upiMerchantName.trim(),
  )}&am=${amountInr.toFixed(2)}&cu=INR&tr=${encodeURIComponent(orderId)}&tn=${encodeURIComponent(
    `MoneyCircle ${coins} Coins`,
  )}`;

  const orderToken = signPayload(`${orderId}|${userId}|${packageId}|${amountInr}`);

  return {
    status: 200,
    data: {
      orderId,
      upiUri,
      orderToken,
      gatewayProvider: 'MoneyCircle Authorized UPI Gateway',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  };
}

export function processWebhookPayload(body: Record<string, unknown>) {
  const {orderId, userId, packageId, amountInr, utrNumber, orderToken} = body;

  if (
    typeof orderId !== 'string' ||
    typeof userId !== 'string' ||
    typeof packageId !== 'string' ||
    typeof amountInr !== 'number' ||
    typeof utrNumber !== 'string' ||
    typeof orderToken !== 'string'
  ) {
    return {status: 400, data: {error: 'Malformed webhook payload.'}};
  }

  const trimmedUtr = utrNumber.trim();
  if (!/^\d{12}$/.test(trimmedUtr)) {
    return {
      status: 400,
      data: {
        error:
          'A valid 12-digit NPCI UTR / transaction reference number is required. Screenshot-only submissions are rejected.',
      },
    };
  }

  const expectedOrderToken = signPayload(`${orderId}|${userId}|${packageId}|${amountInr}`);
  if (!safeCompareHex(orderToken, expectedOrderToken)) {
    return {status: 401, data: {error: 'Webhook signature verification failed.'}};
  }

  const gatewayRef = `GW-${crypto
    .createHash('sha256')
    .update(`${orderId}:${trimmedUtr}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()}`;
  const webhookSignature = signPayload(`${orderId}|${trimmedUtr}|${amountInr}|VERIFIED`);

  return {
    status: 200,
    data: {
      verified: true,
      orderId,
      utrNumber: trimmedUtr,
      gatewayRef,
      webhookSignature,
      verifiedAt: new Date().toISOString(),
    },
  };
}

export function verifySignaturePayload(body: Record<string, unknown>) {
  const {orderId, utrNumber, amountInr, webhookSignature} = body;
  if (
    typeof orderId !== 'string' ||
    typeof utrNumber !== 'string' ||
    typeof amountInr !== 'number' ||
    typeof webhookSignature !== 'string'
  ) {
    return {status: 400, data: {valid: false, error: 'Missing required verification parameters.'}};
  }

  const expected = signPayload(`${orderId}|${utrNumber.trim()}|${amountInr}|VERIFIED`);
  const valid = safeCompareHex(webhookSignature.trim(), expected);
  return {status: 200, data: {valid, orderId, utrNumber: utrNumber.trim()}};
}
