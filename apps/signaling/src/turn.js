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
    'stun:stun.relay.metered.ca:80',
  ];

  const servers = [{ urls: stunServers }];

  const expressUsername = env.EXPRESSTURN_USERNAME;
  const expressPassword = env.EXPRESSTURN_PASSWORD;

  const meteredDomain = env.METERED_TURN_DOMAIN;
  const meteredUsername = env.METERED_TURN_USERNAME;
  const meteredPassword = env.METERED_TURN_PASSWORD;

  const turnSecret = env.TURN_SECRET;
  const turnDomain = env.TURN_DOMAIN;

  if (expressUsername && expressPassword) {
    // ExpressTURN free tier (1TB/month, static credentials)
    servers.push({
      urls: [
        'turn:free.expressturn.com:3478?transport=udp',
        'turn:free.expressturn.com:3478?transport=tcp',
      ],
      username: expressUsername,
      credential: expressPassword,
    });
  }

  if (meteredDomain && meteredUsername && meteredPassword) {
    // Metered.ca free TURN account (static dashboard credential)
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
  } else if (turnDomain && turnSecret && turnDomain !== 'turn.onshare.net') {
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

    servers.push({
      urls: [
        `turn:${turnDomain}:3478?transport=udp`,
        `turn:${turnDomain}:3478?transport=tcp`,
        `turns:${turnDomain}:443?transport=tcp`
      ],
      username,
      credential,
    });
  }

  return servers;
}
