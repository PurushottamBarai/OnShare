import React, { useEffect, useState } from 'react';
import {
  needsConsentPrompt,
  setAdConsent,
  CONSENT_CHANGED_EVENT,
} from '../utils/adConsent.js';

export default function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.navigator.webdriver) return undefined;

    const sync = () => setOpen(needsConsentPrompt());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (!open) return null;

  const choose = (value) => {
    setAdConsent(value);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Advertising consent"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-border-subtle bg-bg-surface shadow-2xl p-4 sm:p-5"
    >
      <p className="text-sm font-semibold text-text-primary mb-1">
        Advertising cookies
      </p>
      <p className="text-xs text-text-secondary leading-relaxed mb-3">
        We use third-party ads to keep OnShare free. Accepting lets our ad partner
        show and measure ads. Ads never access your files or text.
      </p>
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={() => choose('denied')}
          className="px-4 py-2 rounded-xl border border-border-subtle text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => choose('granted')}
          className="px-4 py-2 rounded-xl bg-accent-primary text-bg-base text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Accept ads
        </button>
      </div>
    </div>
  );
}
