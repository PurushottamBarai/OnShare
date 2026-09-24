import React from 'react';

/**
 * Device Label Chip Component (UI Brief section 4.6, SN-10)
 * Displays auto-generated name + device / browser / OS indicators.
 */
export default function DeviceLabelChip({
  name = 'Swift Otter',
  browser = 'Chrome',
  os = 'Windows',
  className = '',
}) {
  return (
    <div
      data-testid="device-label-chip"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-bg-elevated border border-border-subtle text-helper text-text-primary ${className}`}
    >
      <div className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      <span className="font-medium text-text-primary">{name}</span>

      {(browser || os) && (
        <span className="text-xs text-text-secondary">
          · {browser} on {os}
        </span>
      )}
    </div>
  );
}
