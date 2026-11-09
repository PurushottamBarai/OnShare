import React from 'react';

export default function AdSlot({
  height = '90px',
  className = '',
}) {
  return (
    <div
      data-testid="ad-slot"
      className={`w-full flex items-center justify-center transition-all overflow-hidden rounded-xl bg-bg-surface/40 border border-border-subtle/50 ${className}`}
      style={height ? { minHeight: height } : undefined}
      aria-label="Advertisement"
    >
      <div id="ad-container" className="w-full flex items-center justify-center text-xs text-text-secondary/60">
        <span className="sr-only">Advertisement</span>
      </div>
    </div>
  );
}
