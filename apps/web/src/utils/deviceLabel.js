/**
 * Auto-generate friendly device label (PRD SN-10)
 * Example: "Swift Otter, Chrome on Windows"
 */

const ADJECTIVES = [
  'Swift', 'Agile', 'Bright', 'Clever', 'Brave', 'Calm', 'Eager', 'Gentle',
  'Happy', 'Jolly', 'Kind', 'Lively', 'Proud', 'Quick', 'Quiet', 'Wise'
];

const ANIMALS = [
  'Otter', 'Falcon', 'Dolphin', 'Lynx', 'Fox', 'Hawk', 'Panda', 'Tiger',
  'Koala', 'Seal', 'Eagle', 'Badger', 'Wolf', 'Bear', 'Cheetah', 'Owl'
];

function getBrowserAndOS() {
  if (typeof navigator === 'undefined') {
    return { browser: 'Browser', os: 'Device' };
  }

  const ua = navigator.userAgent;
  let browser = 'Browser';
  let os = 'Device';

  // OS detection
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Browser detection
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  return { browser, os };
}

export function generateDeviceLabel() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const { browser, os } = getBrowserAndOS();

  return {
    name: `${adj} ${animal}`,
    browser,
    os,
    fullLabel: `${adj} ${animal}, ${browser} on ${os}`,
  };
}
