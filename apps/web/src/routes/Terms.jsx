import React from 'react';
import { Link } from 'react-router-dom';
import AdSlot from '../components/AdSlot.jsx';

export default function Terms() {
  return (
    <div data-testid="route-terms" className="w-full max-w-content mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-h1 text-text-primary mb-2">Terms of Use</h1>
        <p className="text-helper text-text-secondary">
          Effective date: September 2026 • Acceptable Use & Guidelines
        </p>
      </div>

      <div className="space-y-6 text-sm text-text-secondary leading-relaxed bg-bg-surface p-6 sm:p-8 rounded-card border border-border-subtle">
        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">1. Acceptance of Terms</h2>
          <p>
            By using SharePort, you agree to comply with and be bound by these Terms of Use. If you do not agree to these terms, please discontinue use of the service immediately.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">2. Service Description</h2>
          <p>
            SharePort provides temporary browser-to-browser WebRTC data transmission and real-time live text collaboration without server-side file hosting or user accounts. Both sender and receiver must be online simultaneously for data transfer to succeed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">3. Acceptable Use Policy</h2>
          <p>
            You agree not to use SharePort for any unlawful purpose. Strictly prohibited activities include:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Transmitting malware, viruses, trojans, ransomware, or malicious scripts.</li>
            <li>Distributing infringing copyright material or intellectual property without authorization.</li>
            <li>Sharing harmful, exploitative, threatening, or harassing content.</li>
            <li>Attempting to brute-force 6-digit access codes or bypass rate limiting mechanisms.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">4. Limitation of Liability and Disclaimer</h2>
          <p>
            SharePort is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. Because SharePort does not inspect or store user content, the sender and receiver are solely responsible for verifying the authenticity and safety of files exchanged.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">5. Violation and Reporting</h2>
          <p>
            We take abuse seriously. If you encounter abusive behavior, submit an immediate notice via our <Link to="/report-abuse" className="text-accent-primary underline">Report Abuse</Link> page.
          </p>
        </section>
      </div>

      <AdSlot height="100px" />
    </div>
  );
}
