import React, { useEffect, useRef, useState } from 'react';
import { buildAdHtml } from '../utils/adCreative.js';
import { canShowAds, CONSENT_CHANGED_EVENT } from '../utils/adConsent.js';

const FORMATS = {
  '300x250': { width: 300, height: 250 },
  '728x90': { width: 728, height: 90 },
  '320x50': { width: 320, height: 50 },
};

export default function AdSlot({ format = '300x250', className = '' }) {
  const dimensions = FORMATS[format] || FORMATS['300x250'];
  const reservedHeight = `${dimensions.height}px`;
  const containerRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [allowed, setAllowed] = useState(() => canShowAds());

  useEffect(() => {
    const sync = () => setAllowed(canShowAds());
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!allowed) {
      setMounted(false);
      return undefined;
    }

    const element = containerRef.current;
    if (!element) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [allowed]);

  return (
    <div
      ref={containerRef}
      data-testid="ad-slot"
      aria-label="Advertisement"
      className={`w-full flex flex-col items-center justify-center gap-1 overflow-hidden my-4 ${className}`}
      style={{ minHeight: reservedHeight }}
    >
      <span className="text-[10px] uppercase tracking-wider text-text-secondary">
        Advertisement
      </span>
      <div
        className="flex items-center justify-center"
        style={{ width: dimensions.width, maxWidth: '100%', height: dimensions.height }}
      >
        {allowed && mounted ? (
          <iframe
            title="Advertisement"
            srcDoc={buildAdHtml(dimensions.width, dimensions.height)}
            width={dimensions.width}
            height={dimensions.height}
            style={{
              border: 'none',
              width: dimensions.width,
              height: dimensions.height,
              overflow: 'hidden',
            }}
            scrolling="no"
          />
        ) : null}
      </div>
    </div>
  );
}
