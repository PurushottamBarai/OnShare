/**
 * STUN / TURN Credential Generation (TRD Section 6)
 * Generates short-lived credentials (1 hour) using HMAC-SHA1
 */

export async function generateIceServers(userId, env = {}) {
  const stunServers = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun.cloudflare.com:3478',
  ];

  const servers = [{ urls: stunServers }];

  // Dedicated Primary TURN: ExpressTURN (1,000 GB / 1 TB per month free allowance)
  const expressUsername = env.EXPRESSTURN_USERNAME || '000000002105784935';
  const expressPassword = env.EXPRESSTURN_PASSWORD || 'l1gke0mH+khzFzfYN/akGrr3pD8=';

  if (expressUsername && expressPassword) {
    servers.push({
      urls: [
        'turn:free.expressturn.com:3478?transport=udp',
        'turn:free.expressturn.com:3478?transport=tcp',
      ],
      username: expressUsername,
      credential: expressPassword,
    });
  }

  // Metered.ca fallback (Only attached if explicitly enabled and non-exhausted)
  const enableMetered = env.ENABLE_METERED === 'true';
  const meteredDomain = env.METERED_TURN_DOMAIN;
  const meteredUsername = env.METERED_TURN_USERNAME;
  const meteredPassword = env.METERED_TURN_PASSWORD;

  if (enableMetered && meteredDomain && meteredUsername && meteredPassword) {
    servers.push({
      urls: [
        `turn:${meteredDomain}:80`,
        `turn:${meteredDomain}:80?transport=tcp`,
        `turn:${meteredDomain}:443`,
        `turns:${meteredDomain}:443?transport=tcp`,
      ],
      username: meteredUsername,
      credential: meteredPassword,
    });
  } else if (env.TURN_DOMAIN && env.TURN_SECRET && env.TURN_DOMAIN !== 'turn.onshare.net') {
    // Custom HMAC-SHA1 TURN provider (if configured)
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const username = `${expiry}:${userId}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.TURN_SECRET),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
    const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));

    servers.push({
      urls: [
        `turn:${env.TURN_DOMAIN}:3478?transport=udp`,
        `turn:${env.TURN_DOMAIN}:3478?transport=tcp`,
        `turns:${env.TURN_DOMAIN}:443?transport=tcp`
      ],
      username,
      credential,
    });
  }

  return servers;
}
