import React from 'react';

/**
 * Lockout Banner Component (UI Brief section 4.3, 4.6, SN-9, RC-8)
 * Displayed with status.error background during rate-limited lockouts.
 */
export default function LockoutBanner({
  remainingSeconds = 60,
  message = 'Too many failed code attempts.',
  onRetry,
}) {
  return (
    <div
      data-testid="lockout-banner"
      role="alert"
      className="w-full p-4 rounded-button bg-status-error/15 border border-status-error text-text-primary flex flex-col sm:flex-row items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-status-error text-white flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-body text-text-primary">{message}</p>
          <p className="text-helper text-text-secondary">
            Please wait <span className="font-bold text-status-error">{remainingSeconds}s</span> before trying again.
          </p>
        </div>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          disabled={remainingSeconds > 0}
          className="px-4 py-2 text-sm font-medium rounded-button bg-status-error text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
