import React from 'react';
import { Link } from 'react-router-dom';
import AdSlot from '../components/AdSlot.jsx';

export default function Privacy() {
  return (
    <div data-testid="route-privacy" className="w-full max-w-content mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-h1 text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-helper text-text-secondary">
          Last updated: September 2026 • Privacy by Architecture
        </p>
      </div>

      <div className="space-y-6 text-sm text-text-secondary leading-relaxed bg-bg-surface p-6 sm:p-8 rounded-card border border-border-subtle">
        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">1. Our Core Principle: Zero Content Storage</h2>
          <p>
            SharePort is built from the ground up so that your files, file names, and shared text never touch our disks or databases. All transfers stream directly from browser to browser using peer-to-peer WebRTC connections protected by DTLS encryption.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">2. Ephemeral Signalling Data</h2>
          <p>
            To connect two browsers, our signalling coordination service relays session discovery messages:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>6-Digit Access Codes:</strong> Held strictly in volatile memory for at most 10 minutes and permanently discarded upon match or expiry.</li>
            <li><strong>Session Identifiers:</strong> Random ephemeral tokens that expire when you close your tab or after your chosen session duration.</li>
            <li><strong>WebRTC SDP & ICE Candidates:</strong> Connection metadata containing network addresses necessary to establish direct browser-to-browser peer connections.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">3. Network Addresses and WebRTC</h2>
          <p>
            By nature of peer-to-peer WebRTC connections, each peer browser discovers the other peer&apos;s public network address to route packets directly. Local IP addresses are masked with mDNS hostnames. If a direct link fails and TURN relay is used, encrypted packets pass through the relay server without the relay possessing decryption keys.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">4. No Accounts, No Cookies, No Tracking</h2>
          <p>
            SharePort requires no registration, email, or passwords. We do not store persistent tracking cookies or collect personally identifiable information (PII). We comply with modern privacy legislation including GDPR and India&apos;s Digital Personal Data Protection Act.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-h2 text-text-primary">5. Contact and Inquiries</h2>
          <p>
            Questions regarding our privacy architecture? Visit our <Link to="/contact" className="text-accent-primary underline">Contact page</Link> or report suspicious activity at our <Link to="/report-abuse" className="text-accent-primary underline">Abuse Center</Link>.
          </p>
        </section>
      </div>

      <AdSlot height="100px" />
    </div>
  );
}
