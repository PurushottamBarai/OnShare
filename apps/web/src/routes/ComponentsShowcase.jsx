import React, { useState } from 'react';
import StatusPill from '../components/StatusPill.jsx';
import DeviceLabelChip from '../components/DeviceLabelChip.jsx';
import LockoutBanner from '../components/LockoutBanner.jsx';
import AdSlot from '../components/AdSlot.jsx';

export default function ComponentsShowcase() {
  const [lockoutCountdown, setLockoutCountdown] = useState(45);

  return (
    <div data-testid="route-components" className="w-full max-w-content mx-auto py-8 px-4 space-y-10">
      <div className="border-b border-border-subtle pb-4">
        <h1 className="text-h1 text-text-primary">Shared UI Components</h1>
        <p className="text-helper text-text-secondary">
          Isolated rendering of all design system components across their documented states (UI Brief Section 3 & 4.6).
        </p>
      </div>

      {/* 1. Status Pill Set */}
      <section className="space-y-4">
        <h2 className="text-h2 text-text-primary">1. Status Pill Set (WCAG 2.1 AA Compliant)</h2>
        <p className="text-helper text-text-secondary">
          Dual indicators (Color + Uppercase Text) per UI Brief Section 3.5 & 4.6.
        </p>

        <div className="p-6 rounded-card bg-bg-surface border border-border-subtle flex flex-wrap gap-4 items-center">
          <StatusPill status="connecting" />
          <StatusPill status="waiting" />
          <StatusPill status="sending" progress={45} />
          <StatusPill status="sending" progress={92} />
          <StatusPill status="done" />
          <StatusPill status="declined" />
          <StatusPill status="failed" />
        </div>
      </section>

      {/* 2. Device Label Chip */}
      <section className="space-y-4">
        <h2 className="text-h2 text-text-primary">2. Device Label Chip (SN-10)</h2>
        <p className="text-helper text-text-secondary">
          Auto-generated friendly name + browser and OS badge for connection recognizability.
        </p>

        <div className="p-6 rounded-card bg-bg-surface border border-border-subtle flex flex-wrap gap-4 items-center">
          <DeviceLabelChip name="Swift Otter" browser="Chrome" os="Windows" />
          <DeviceLabelChip name="Swift Dolphin" browser="Safari" os="macOS" />
          <DeviceLabelChip name="Curious Falcon" browser="Firefox" os="Linux" />
          <DeviceLabelChip name="Agile Lynx" browser="Chrome" os="Android" />
        </div>
      </section>

      {/* 3. Lock-out Banner */}
      <section className="space-y-4">
        <h2 className="text-h2 text-text-primary">3. Lock-out Banner (SN-9, RC-8)</h2>
        <p className="text-helper text-text-secondary">
          Shown after repeated wrong-code entries with status.error background and countdown.
        </p>

        <div className="space-y-4">
          <LockoutBanner
            remainingSeconds={lockoutCountdown}
            message="Too many failed code attempts. Session locked temporarily."
            onRetry={() => setLockoutCountdown(0)}
          />

          <LockoutBanner
            remainingSeconds={0}
            message="Lockout period expired."
            onRetry={() => setLockoutCountdown(60)}
          />
        </div>
      </section>

      {/* 4. Reserved Ad Slot */}
      <section className="space-y-4">
        <h2 className="text-h2 text-text-primary">4. Reserved Ad Slot (AD-1)</h2>
        <p className="text-helper text-text-secondary">
          Neutral frame distinct from bg.elevated with &quot;Advertisement&quot; label, strictly preserving layout stability.
        </p>

        <AdSlot height="100px" />
      </section>
    </div>
  );
}
