import {sendJson, type ApiRequest, type ApiResponse} from './_lib/paymentCrypto';

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, {error: 'Method not allowed'});
    return;
  }
  sendJson(res, 200, {
    status: 'ok',
    service: 'MoneyCircle Payment & Ledger API',
    timestamp: new Date().toISOString(),
  });
}
