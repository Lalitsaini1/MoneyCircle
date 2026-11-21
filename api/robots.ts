import type {ApiRequest, ApiResponse} from './_lib/paymentCrypto';
import {generateRobotsTxt, resolveSiteOrigin} from './_lib/sitemap';

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const origin = resolveSiteOrigin(req);
  const txt = generateRobotsTxt(origin);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(txt);
}
