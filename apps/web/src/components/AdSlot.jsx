import React, { useEffect, useRef } from 'react';

export default function AdSlot({ className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const confScript = document.createElement('script');
    confScript.type = 'text/javascript';
    confScript.text = `
      atOptions = {
        'key' : 'd5470d15981d62ce4586cbb96f11ed01',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    `;

    const adScript = document.createElement('script');
    adScript.type = 'text/javascript';
    adScript.src = 'https://bauval.org/22/d5470d15981d62ce4586cbb96f11ed01';

    containerRef.current.appendChild(confScript);
    containerRef.current.appendChild(adScript);
  }, []);

  return (
    <div
      data-testid="ad-slot"
      className={`w-full flex items-center justify-center overflow-hidden my-4 ${className}`}
      aria-label="Advertisement"
    >
      <div
        ref={containerRef}
        style={{ width: '300px', height: '250px', minWidth: '300px', minHeight: '250px' }}
        className="flex items-center justify-center overflow-hidden rounded-xl"
      />
    </div>
  );
}
