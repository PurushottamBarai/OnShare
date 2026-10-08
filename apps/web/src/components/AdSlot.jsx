import React, { useEffect, useRef } from 'react';

const ADSENSE_CLIENT_ID = 'ca-pub-7296843155272709';

export default function AdSlot({
  slotId = '',
  format = 'auto',
  responsive = 'true',
  height = '100px',
  _type = 'banner',
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
        void 0;
      }
    }
  }, []);

  return (
    <div
      data-testid="ad-slot"
      className={`w-full flex items-center justify-center transition-all overflow-hidden ${className}`}
      style={height ? { minHeight: height } : undefined}
      aria-label="Advertisement"
    >
      <span className="sr-only">Advertisement</span>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
        data-ad-client={ADSENSE_CLIENT_ID}
        {...(slotId ? { 'data-ad-slot': slotId } : {})}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
}
