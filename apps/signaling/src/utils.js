import { serializeMessage } from '@shareport/protocol';

/**
 * Generate 6 decimal digits with cryptographically secure rejection sampling (TRD 4.1)
 * Leading zeros allowed ('000000' - '999999').
 */
export function generate6DigitCode() {
  const range = 1_000_000;
  // Maximum multiple of 1,000,000 less than 2^32
  const limit = Math.floor(0x100000000 / range) * range;
  const buffer = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) {
      const codeNum = buffer[0] % range;
      return codeNum.toString().padStart(6, '0');
    }
  }
}

/**
 * Hash client IP address with salt (TRD 4.2 & 5.4)
 */
export async function hashAddress(address, salt = 'shareport-salt-v1') {
  const encoder = new TextEncoder();
  const data = encoder.encode((address || 'unknown') + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Extract client IP from Cloudflare or standard headers
 */
export function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

/**
 * Send JSON protocol message over WebSocket safely
 */
export function sendWsMessage(ws, type, payload = {}, id = null) {
  if (!ws || ws.readyState !== 1 /* OPEN */) {
    return false;
  }
  try {
    const raw = serializeMessage(type, payload, id);
    ws.send(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Platform-independent WebSocketPair creator
 */
export function createWebSocketPair() {
  if (typeof WebSocketPair !== 'undefined') {
    return new WebSocketPair();
  }
  // In non-workerd environments (e.g. testing), tests provide pair or polyfill
  throw new Error('WebSocketPair is not supported in this runtime. Polyfill or test harness required.');
}

/**
 * Platform-independent WebSocket 101 Switching Protocols response creator
 */
export function createWebSocketResponse(clientWebSocket) {
  try {
    return new Response(null, {
      status: 101,
      webSocket: clientWebSocket,
    });
  } catch {
    // Node.js native Response limits status to 200..599, whereas Cloudflare Workers supports 101
    const res = new Response(null, { status: 200 });
    Object.defineProperty(res, 'status', { value: 101 });
    res.webSocket = clientWebSocket;
    return res;
  }
}

