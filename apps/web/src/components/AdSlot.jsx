import React, { useEffect, useRef } from 'react';

const ADSENSE_CLIENT_ID = 'ca-pub-7296843155272709';

/**
 * Ad Slot Component (UI Brief sections 3.5, 4.1, PRD AD-1)
 * Reserved fixed container with neutral frame distinct from bg.elevated.
 * Ensures zero layout shifts, completely non-intrusive placement outside main cards.
 */
export default function AdSlot({
  slotId = '',
  format = 'auto',
  responsive = 'true',
  height = '100px',
  type = 'banner', // 'banner' | 'sidebar'
  className = '',
}) {
  const adRef = useRef(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!pushedRef.current && typeof window !== 'undefined') {
      try {
        if (window.adsbygoogle) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushedRef.current = true;
        }
      } catch {
        // Gracefully ignore during testing or pending approval
      }
    }
  }, []);

  const isSidebar = type === 'sidebar';
  const minHeightStyle = isSidebar ? '360px' : height;

  return (
    <div
      data-testid="ad-slot"
      className={`w-full rounded-xl bg-ad-bg/30 border border-ad-border/60 flex flex-col items-center justify-between p-3 text-center transition-all ${className}`}
      style={{ minHeight: minHeightStyle }}
      aria-label="Advertisement"
    >
      <div className="w-full flex items-center justify-between mb-1.5 px-1">
        <span className="text-[10px] tracking-wider uppercase text-text-secondary/80 font-medium">
          Advertisement
        </span>
        <span className="text-[9px] text-text-secondary/50 uppercase tracking-tight">
          Sponsor
        </span>
      </div>

      <div className="w-full flex-1 flex items-center justify-center overflow-hidden rounded">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            minHeight: isSidebar ? '300px' : '90px'
          }}
          data-ad-client={ADSENSE_CLIENT_ID}
          {...(slotId ? { 'data-ad-slot': slotId } : {})}
          data-ad-format={format}
          data-full-width-responsive={responsive}
        />
      </div>
    </div>
  );
}
