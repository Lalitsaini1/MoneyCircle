import {sendJson, type ApiRequest, type ApiResponse} from './_lib/paymentCrypto';
import {resolveSiteOrigin} from './_lib/sitemap';

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, {error: 'Method not allowed'});
    return;
  }
  sendJson(res, 200, {
    status: 'ok',
    service: 'MoneyCircle Payment & Ledger API',
    siteUrl: resolveSiteOrigin(req),
    timestamp: new Date().toISOString(),
  });
}
