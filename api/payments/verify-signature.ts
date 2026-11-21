import {
  readJsonBody,
  sendJson,
  verifySignaturePayload,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/paymentCrypto';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, {error: 'Method not allowed'});
    return;
  }
  try {
    const body = await readJsonBody(req);
    const result = verifySignaturePayload(body);
    sendJson(res, result.status, result.data);
  } catch {
    sendJson(res, 400, {valid: false, error: 'Invalid verification request'});
  }
}
