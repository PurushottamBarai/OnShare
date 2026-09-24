import React from 'react';
import { Link } from 'react-router-dom';
import AdSlot from '../components/AdSlot.jsx';

export default function HowItWorks() {
  return (
    <div data-testid="route-how-it-works" className="w-full max-w-content mx-auto py-10 px-4 space-y-10">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-h1 text-text-primary mb-3">How SharePort Works</h1>
        <p className="text-body text-text-secondary">
          Reversed OTP verification and direct browser-to-browser WebRTC streaming.
          No uploads, no cloud storage, no account required.
        </p>
      </div>

      {/* 3 Step Visual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-card bg-bg-surface border border-border-subtle flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-lg">
            1
          </div>
          <h2 className="text-h2 text-text-primary">Receiver Generates Code</h2>
          <p className="text-helper text-text-secondary leading-relaxed">
            The receiver taps <strong>Receive</strong> to generate a unique 6-digit access code valid for 10 minutes.
          </p>
        </div>

        <div className="p-6 rounded-card bg-bg-surface border border-border-subtle flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-lg">
            2
          </div>
          <h2 className="text-h2 text-text-primary">Sender Enters Code</h2>
          <p className="text-helper text-text-secondary leading-relaxed">
            The receiver shares the code. The sender enters it to approve connection and sends a preview manifest.
          </p>
        </div>

        <div className="p-6 rounded-card bg-bg-surface border border-border-subtle flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-lg">
            3
          </div>
          <h2 className="text-h2 text-text-primary">Direct P2P Stream</h2>
          <p className="text-helper text-text-secondary leading-relaxed">
            Receiver reviews file details and taps Accept. Encrypted data streams browser-to-browser with zero server storage.
          </p>
        </div>
      </div>

      {/* Deep Dive Architecture Details */}
      <div className="p-6 sm:p-8 rounded-card bg-bg-surface border border-border-subtle space-y-6 text-sm text-text-secondary leading-relaxed">
        <h2 className="text-h2 text-text-primary">The Architecture Behind SharePort</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-text-primary mb-1">Reversed Access Code (The Security Gate)</h3>
            <p>
              Unlike traditional tools where the sender issues a link that anyone can open if overheard, SharePort reverses the flow: the receiver generates the code, and the sender must explicitly type it in. Even with a code, nothing is sent until the sender approves and the receiver reviews the incoming manifest.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Live Streaming ZIP Packaging</h3>
            <p>
              When multiple files are shared, SharePort packages them on the fly into an uncompressed ZIP archive using streaming chunk reads. The sender&apos;s browser never buffers multi-gigabyte archives into RAM, keeping memory flat and constant.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-text-primary mb-1">Conflict-Free Live Text (Yjs CRDTs)</h3>
            <p>
              In Share Text mode, participants edit a shared plain-text document in real time. Changes are merged deterministically using Conflict-free Replicated Data Types (CRDTs) over WebRTC text data channels without central coordination.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border-subtle flex flex-wrap gap-4 justify-center">
          <Link to="/send" className="px-5 py-2.5 rounded-button font-semibold bg-accent-primary text-bg-base hover:bg-accent-hover cursor-pointer">
            Send Files Now
          </Link>
          <Link to="/receive" className="px-5 py-2.5 rounded-button font-semibold bg-bg-elevated border border-border-subtle text-text-primary hover:border-accent-primary cursor-pointer">
            Receive Content
          </Link>
        </div>
      </div>

      <AdSlot height="100px" />
    </div>
  );
}
