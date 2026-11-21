import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {
  createAuthorizedOrderPayload,
  processWebhookPayload,
  verifySignaturePayload,
} from './api/_lib/paymentCrypto';
import {generateRobotsTxt, generateSitemapXml, resolveSiteOrigin} from './api/_lib/sitemap';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

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
    const result = createAuthorizedOrderPayload((req.body ?? {}) as Record<string, unknown>);
    res.status(result.status).json(result.data);
  });

  app.post('/api/payments/webhook', (req, res) => {
    const result = processWebhookPayload((req.body ?? {}) as Record<string, unknown>);
    res.status(result.status).json(result.data);
  });

  app.post('/api/payments/verify-signature', (req, res) => {
    const result = verifySignaturePayload((req.body ?? {}) as Record<string, unknown>);
    res.status(result.status).json(result.data);
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = resolveSiteOrigin(req);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(generateSitemapXml(origin));
  });

  app.get('/robots.txt', (req, res) => {
    const origin = resolveSiteOrigin(req);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(generateRobotsTxt(origin));
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true, hmr: false},
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
