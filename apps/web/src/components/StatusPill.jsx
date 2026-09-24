import React from 'react';

/**
 * Status Pill Component (UI Brief sections 3.3, 3.5, 4.6)
 * Accessibility WCAG 2.1 AA: Color + uppercase text label together.
 *
 * Supported states:
 * - 'connecting' (status.pending)
 * - 'waiting'    (status.warning - "WAITING FOR ACCEPT")
 * - 'sending'    (accent.primary with percentage)
 * - 'done'       (status.success)
 * - 'declined'   (status.error outline)
 * - 'failed'     (status.error)
 */
export default function StatusPill({ status, progress, label }) {
  const normStatus = (status || 'connecting').toLowerCase();

  switch (normStatus) {
    case 'connecting':
      return (
        <span
          data-testid="status-pill-connecting"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-pill font-medium uppercase tracking-wide bg-status-pending/20 text-status-pending border border-status-pending/40"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-status-pending animate-pulse" />
          {label || 'CONNECTING'}
        </span>
      );

    case 'waiting':
    case 'waiting_accept':
      return (
        <span
          data-testid="status-pill-waiting"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-pill font-medium uppercase tracking-wide bg-status-warning/20 text-status-warning border border-status-warning/40"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
          {label || 'WAITING FOR ACCEPT'}
        </span>
      );

    case 'sending':
      return (
        <span
          data-testid="status-pill-sending"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-pill font-medium uppercase tracking-wide bg-accent-primary/20 text-accent-primary border border-accent-primary/40"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-ping" />
          {label || `SENDING ${progress !== undefined ? `${progress}%` : ''}`.trim()}
        </span>
      );

    case 'done':
      return (
        <span
          data-testid="status-pill-done"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-pill font-medium uppercase tracking-wide bg-status-success/20 text-status-success border border-status-success/40"
        >
          <svg className="w-3.5 h-3.5 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          {label || 'DONE'}
        </span>
      );

    case 'declined':
      return (
        <span
          data-testid="status-pill-declined"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-pill font-medium uppercase tracking-wide bg-transparent text-status-error border-2 border-status-error/80"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-status-error" />
          {label || 'DECLINED'}
        </span>
      );

    case 'failed':
    default:
      return (
        <span
          data-testid="status-pill-failed"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-pill font-medium uppercase tracking-wide bg-status-error/20 text-status-error border border-status-error/40"
        >
          <svg className="w-3.5 h-3.5 text-status-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {label || 'FAILED'}
        </span>
      );
  }
}
