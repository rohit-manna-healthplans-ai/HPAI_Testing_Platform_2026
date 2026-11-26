import crypto from 'node:crypto';

/**
 * JSON response with a content ETag (304 when the client already has it). `etagSource` should EXCLUDE volatile fields
 * (server_now, seconds_left) so unchanged polls cost a few bytes.
 */
export function sendJsonEtag(req, res, payload, etagSource = payload) {
  const tag = `W/"${crypto.createHash('sha1').update(JSON.stringify(etagSource)).digest('base64url').slice(0, 22)}"`;
  res.set('ETag', tag);
  res.set('Cache-Control', 'private, no-cache');
  if (req.headers['if-none-match'] === tag) return res.status(304).end();
  return res.json(payload);
}
