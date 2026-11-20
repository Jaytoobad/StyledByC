import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    return;
  }

  console.error(
    '[client-error]',
    JSON.stringify({
      message: payload.message,
      stack: payload.stack,
      url: payload.url,
      userAgent: payload.userAgent,
      timestamp: payload.timestamp,
      context: payload.context,
    }),
  );

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true }));
}
