import React from 'react';

/**
 * Ad Slot Component (UI Brief sections 3.5, 4.1, PRD AD-1)
 * Reserved fixed-height container with neutral frame distinct from bg.elevated.
 * Ensures zero layout shifts and clearly demarcated advertisement boundaries.
 */
export default function AdSlot({
  height = '100px',
  className = '',
}) {
  return (
    <div
      data-testid="ad-slot"
      className={`w-full max-w-content mx-auto rounded-card bg-ad-bg border border-ad-border flex flex-col items-center justify-center p-3 text-center my-6 ${className}`}
      style={{ minHeight: height, height }}
      aria-label="Advertisement"
    >
      <span className="text-[10px] tracking-wider uppercase text-text-secondary opacity-70 mb-1">
        Advertisement
      </span>
      <div className="w-full flex-1 border border-dashed border-ad-border/60 rounded flex items-center justify-center">
        <span className="text-xs text-text-secondary/60">Reserved Sponsorship Space (Non-intrusive)</span>
      </div>
    </div>
  );
}
