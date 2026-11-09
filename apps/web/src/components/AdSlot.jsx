import React from 'react';

export default function AdSlot({ className = '' }) {
  const adHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>* { margin: 0; padding: 0; } body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; }</style></head><body><script type="text/javascript">atOptions = { 'key' : 'd5470d15981d62ce4586cbb96f11ed01', 'format' : 'iframe', 'height' : 250, 'width' : 300, 'params' : {} };</script><script type="text/javascript" src="https://bauval.org/22/d5470d15981d62ce4586cbb96f11ed01"></script></body></html>`;

  return (
    <div
      data-testid="ad-slot"
      className={`w-full flex items-center justify-center overflow-hidden my-4 ${className}`}
      aria-label="Advertisement"
    >
      <iframe
        title="Advertisement"
        srcDoc={adHtml}
        width="300"
        height="250"
        style={{ border: 'none', width: '300px', height: '250px', overflow: 'hidden' }}
        scrolling="no"
      />
    </div>
  );
}
