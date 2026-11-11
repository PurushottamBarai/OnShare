const CONSENT_KEY = 'onshare-ad-consent';
export const CONSENT_CHANGED_EVENT = 'onshare-ad-consent-change';

const EEA_TIMEZONES = new Set([
  'Europe/Amsterdam',
  'Europe/Andorra',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Bucharest',
  'Europe/Budapest',
  'Europe/Chisinau',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Kyiv',
  'Europe/Lisbon',
  'Europe/Ljubljana',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Monaco',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Podgorica',
  'Europe/Prague',
  'Europe/Reykjavik',
  'Europe/Riga',
  'Europe/Rome',
  'Europe/San_Marino',
  'Europe/Sarajevo',
  'Europe/Skopje',
  'Europe/Sofia',
  'Europe/Stockholm',
  'Europe/Tallinn',
  'Europe/Tirane',
  'Europe/Vaduz',
  'Europe/Vatican',
  'Europe/Vienna',
  'Europe/Vilnius',
  'Europe/Warsaw',
  'Europe/Zagreb',
  'Europe/Zurich',
  'Atlantic/Azores',
  'Atlantic/Canary',
  'Atlantic/Madeira',
  'Atlantic/Reykjavik',
]);

const hasStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const isEeaVisitor = () => {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return EEA_TIMEZONES.has(timeZone);
  } catch {
    return false;
  }
};

export const getAdConsent = () => {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
};

export const setAdConsent = (value) => {
  if (hasStorage()) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      void 0;
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }
};

export const canShowAds = () => {
  const value = getAdConsent();
  if (value === 'granted') return true;
  if (value === 'denied') return false;
  return !isEeaVisitor();
};

export const needsConsentPrompt = () => isEeaVisitor() && getAdConsent() === null;
