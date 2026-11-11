import React, { useCallback, useEffect, useState } from 'react';
import { buildAdHtml } from '../utils/adCreative.js';
import { canShowAds, CONSENT_CHANGED_EVENT } from '../utils/adConsent.js';
import { getTransferStatus, subscribeTransferStatus } from '../utils/transferState.js';

const DISMISS_KEY = 'onshare-floating-ad-dismissed-at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

const readDismissed = () => {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_MS;
  } catch {
    return false;
  }
};

export default function FloatingAd() {
  const [desktop, setDesktop] = useState(false);
  const [allowed, setAllowed] = useState(() => canShowAds());
  const [dismissed, setDismissed] = useState(readDismissed);
  const [ready, setReady] = useState(false);
  const [transferActive, setTransferActive] = useState(
    () => !!getTransferStatus().isActive
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const sync = () => setAllowed(canShowAds());
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    setTransferActive(!!getTransferStatus().isActive);
    return subscribeTransferStatus((status) => setTransferActive(!!status.isActive));
  }, []);

  useEffect(() => {
    if (!desktop || !allowed || dismissed) return undefined;
    const idle =
      window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1200));
    const handle = idle(() => setReady(true));
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [desktop, allowed, dismissed]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      void 0;
    }
    setDismissed(true);
  }, []);

  useEffect(() => {
    if (dismissed) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismiss, dismissed]);

  if (typeof navigator !== 'undefined' && navigator.webdriver) return null;
  if (!desktop || !allowed || dismissed || transferActive || !ready) return null;

  return (
    <aside
      className="fixed bottom-4 right-4 z-20 hidden lg:block"
      aria-label="Advertisement"
    >
      <div className="flex w-[300px] flex-col items-center gap-1 bg-transparent">
        <div className="flex w-full items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-text-secondary">
            Advertisement
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close advertisement"
            className="w-6 h-6 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div
          className="flex items-center justify-center bg-transparent"
          style={{ width: 300, height: 250 }}
        >
          <iframe
            title="Advertisement"
            srcDoc={buildAdHtml(300, 250)}
            width={300}
            height={250}
            style={{ border: 'none', width: 300, height: 250, overflow: 'hidden' }}
            scrolling="no"
          />
        </div>
      </div>
    </aside>
  );
}
