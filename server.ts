import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET && process.env.PAYMENT_WEBHOOK_SECRET.trim().length > 0
    ? process.env.PAYMENT_WEBHOOK_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

interface ServerPaymentOrder {
  orderId: string;
  userId: string;
  packageId: string;
  coins: number;
  amountInr: number;
  upiMerchantId: string;
  upiMerchantName: string;
  upiUri: string;
  orderToken: string;
  status: 'CREATED' | 'WEBHOOK_VERIFIED';
  utrNumber?: string;
  gatewayRef?: string;
  webhookSignature?: string;
  createdAt: number;
}

const paymentOrders = new Map<string, ServerPaymentOrder>();

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
}

function safeCompareHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '256kb'}));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'MoneyCircle Payment & Ledger API',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/payments/create-order', (req, res) => {
    const {userId, packageId, coins, amountInr, upiMerchantId, upiMerchantName} = req.body ?? {};

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
      res.status(400).json({error: 'Invalid authorized payment configuration or package parameters.'});
      return;
    }

    // Enforce 1 Coin = 1 INR conversion parity for standard packages
    if (Math.abs(coins - amountInr) > 0.01) {
      res.status(400).json({error: 'Coin package valuation mismatch (1 Coin must equal ₹1).'});
      return;
    }

    const orderId = `MCORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiMerchantId.trim())}&pn=${encodeURIComponent(
      upiMerchantName.trim(),
    )}&am=${amountInr.toFixed(2)}&cu=INR&tr=${encodeURIComponent(orderId)}&tn=${encodeURIComponent(
      `MoneyCircle ${coins} Coins`,
    )}`;

    const orderToken = signPayload(`${orderId}|${userId}|${packageId}|${amountInr}`);
    const order: ServerPaymentOrder = {
      orderId,
      userId,
      packageId,
      coins,
      amountInr,
      upiMerchantId: upiMerchantId.trim(),
      upiMerchantName: upiMerchantName.trim(),
      upiUri,
      orderToken,
      status: 'CREATED',
      createdAt: Date.now(),
    };

    paymentOrders.set(orderId, order);

    res.json({
      orderId,
      upiUri,
      orderToken,
      gatewayProvider: 'MoneyCircle Authorized UPI Gateway',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  });

  app.post('/api/payments/webhook', (req, res) => {
    const {orderId, userId, packageId, amountInr, utrNumber, orderToken} = req.body ?? {};

    if (
      typeof orderId !== 'string' ||
      typeof userId !== 'string' ||
      typeof packageId !== 'string' ||
      typeof amountInr !== 'number' ||
      typeof utrNumber !== 'string' ||
      typeof orderToken !== 'string'
    ) {
      res.status(400).json({error: 'Malformed webhook payload.'});
      return;
    }

    const trimmedUtr = utrNumber.trim();
    if (!/^\d{12}$/.test(trimmedUtr)) {
      res.status(400).json({
        error: 'A valid 12-digit NPCI UTR / transaction reference number is required. Screenshot-only submissions are rejected.',
      });
      return;
    }

    const expectedOrderToken = signPayload(`${orderId}|${userId}|${packageId}|${amountInr}`);
    if (!safeCompareHex(orderToken, expectedOrderToken)) {
      res.status(401).json({error: 'Webhook signature verification failed.'});
      return;
    }

    const gatewayRef = `GW-${crypto.createHash('sha256').update(`${orderId}:${trimmedUtr}`).digest('hex').slice(0, 12).toUpperCase()}`;
    const webhookSignature = signPayload(`${orderId}|${trimmedUtr}|${amountInr}|VERIFIED`);

    const existing = paymentOrders.get(orderId);
    if (existing) {
      existing.status = 'WEBHOOK_VERIFIED';
      existing.utrNumber = trimmedUtr;
      existing.gatewayRef = gatewayRef;
      existing.webhookSignature = webhookSignature;
    }

    res.json({
      verified: true,
      orderId,
      utrNumber: trimmedUtr,
      gatewayRef,
      webhookSignature,
      verifiedAt: new Date().toISOString(),
    });
  });

  app.post('/api/payments/verify-signature', (req, res) => {
    const {orderId, utrNumber, amountInr, webhookSignature} = req.body ?? {};
    if (
      typeof orderId !== 'string' ||
      typeof utrNumber !== 'string' ||
      typeof amountInr !== 'number' ||
      typeof webhookSignature !== 'string'
    ) {
      res.status(400).json({valid: false, error: 'Missing required verification parameters.'});
      return;
    }

    const expected = signPayload(`${orderId}|${utrNumber.trim()}|${amountInr}|VERIFIED`);
    const valid = safeCompareHex(webhookSignature.trim(), expected);
    res.json({valid, orderId, utrNumber: utrNumber.trim()});
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MoneyCircle server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MoneyCircle server:', err);
  process.exit(1);
});
