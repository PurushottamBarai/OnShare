/**
 * STUN / TURN Credential Generation (TRD Section 6)
 * Generates short-lived credentials (1 hour) using HMAC-SHA1
 */

export async function generateIceServers(userId, env = {}) {
  const stunServers = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun.cloudflare.com:3478'
  ];

  const turnSecret = env.TURN_SECRET || 'shareport-dev-turn-secret';
  const turnDomain = env.TURN_DOMAIN || 'turn.shareport.net';

  // 1-hour expiration per TRD section 6
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const username = `${expiry}:${userId}`;

  // HMAC-SHA1 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(turnSecret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
  const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return [
    {
      urls: stunServers,
    },
    {
      urls: [
        `turn:${turnDomain}:3478?transport=udp`,
        `turn:${turnDomain}:3478?transport=tcp`,
        `turns:${turnDomain}:443?transport=tcp`
      ],
      username,
      credential,
    },
  ];
}
