import React from 'react';
import { Link } from 'react-router-dom';
import AdSlot from '../components/AdSlot.jsx';

export default function Home() {
  return (
    <div data-testid="route-home" className="w-full max-w-content mx-auto py-6 sm:py-10 px-4">
      {/* Hero section with Headline & Trust Bullets */}
      <section className="text-center mb-10">
        <h1 className="text-h1 text-text-primary tracking-tight mb-3">
          Direct, Private Browser Sharing
        </h1>
        <p className="text-body text-text-secondary max-w-xl mx-auto mb-6">
          Send files and live text browser-to-browser with reverse 6-digit access codes.
          No sign-ups, no file limits, and zero content stored on servers.
        </p>

        {/* Trust Badges / Bullets per UI brief section 2 */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-helper text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-4 h-4 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Direct WebRTC P2P
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-4 h-4 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            End-to-End Encrypted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-4 h-4 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Reversed OTP Control
          </span>
        </div>
      </section>

      {/* Primary Action Cards (HM-1, HM-2): Responsive side-by-side or stacked on mobile */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        {/* Card 1: Send Files */}
        <Link
          to="/send"
          data-testid="home-card-send"
          className="group flex flex-col justify-between p-6 rounded-card bg-bg-elevated border border-border-subtle hover:border-accent-primary transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
        >
          <div>
            <div className="w-12 h-12 rounded-card bg-accent-primary/10 text-accent-primary flex items-center justify-center mb-4 group-hover:bg-accent-primary group-hover:text-bg-base transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h2 className="text-h2 text-text-primary mb-2 group-hover:text-accent-primary transition-colors">
              Send
            </h2>
            <p className="text-helper text-text-secondary">
              Select files or drag & drop. Multi-file bundles are streamed into a ZIP on the fly.
            </p>
          </div>
          <div className="mt-6 flex items-center text-sm font-semibold text-accent-primary group-hover:text-accent-hover">
            <span>Choose Files</span>
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </div>
        </Link>

        {/* Card 2: Share Text */}
        <Link
          to="/text"
          data-testid="home-card-text"
          className="group flex flex-col justify-between p-6 rounded-card bg-bg-elevated border border-border-subtle hover:border-accent-primary transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
        >
          <div>
            <div className="w-12 h-12 rounded-card bg-accent-primary/10 text-accent-primary flex items-center justify-center mb-4 group-hover:bg-accent-primary group-hover:text-bg-base transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-h2 text-text-primary mb-2 group-hover:text-accent-primary transition-colors">
              Share Text
            </h2>
            <p className="text-helper text-text-secondary">
              Share notes, code snippets, or text live with multi-peer collaborative editing.
            </p>
          </div>
          <div className="mt-6 flex items-center text-sm font-semibold text-accent-primary group-hover:text-accent-hover">
            <span>Compose Text</span>
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </div>
        </Link>

        {/* Card 3: Receive (RC-1: Tapping immediately generates code, NO input field) */}
        <Link
          to="/receive"
          data-testid="home-card-receive"
          className="group flex flex-col justify-between p-6 rounded-card bg-bg-elevated border border-border-subtle hover:border-accent-primary transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
        >
          <div>
            <div className="w-12 h-12 rounded-card bg-accent-primary/10 text-accent-primary flex items-center justify-center mb-4 group-hover:bg-accent-primary group-hover:text-bg-base transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h2 className="text-h2 text-text-primary mb-2 group-hover:text-accent-primary transition-colors">
              Receive
            </h2>
            <p className="text-helper text-text-secondary">
              Tap to generate a fresh 6-digit access code to give to your sender.
            </p>
          </div>
          <div className="mt-6 flex items-center text-sm font-semibold text-accent-primary group-hover:text-accent-hover">
            <span>Get Code</span>
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </div>
        </Link>
      </section>

      {/* 3-Step "How it works" Strip (HM-3, UI Brief 4.1) */}
      <section className="mb-12 p-6 sm:p-8 rounded-card bg-bg-surface border border-border-subtle">
        <div className="text-center mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent-primary">
            Simple 3-Step Process
          </span>
          <h2 className="text-h2 text-text-primary mt-1">How SharePort Works</h2>
          <p className="text-helper text-text-secondary mt-1">
            &ldquo;Receiver gets a code, sender enters it.&rdquo;
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex flex-col items-center text-center p-4 rounded-button bg-bg-elevated/50 border border-border-subtle/50">
            <div className="w-8 h-8 rounded-full bg-accent-primary text-bg-base font-bold flex items-center justify-center mb-3">
              1
            </div>
            <h3 className="font-semibold text-body text-text-primary mb-1">Receiver Gets Code</h3>
            <p className="text-helper text-text-secondary">
              Receiver taps <strong>Receive</strong> to generate a unique, single-use 6-digit access code.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-4 rounded-button bg-bg-elevated/50 border border-border-subtle/50">
            <div className="w-8 h-8 rounded-full bg-accent-primary text-bg-base font-bold flex items-center justify-center mb-3">
              2
            </div>
            <h3 className="font-semibold text-body text-text-primary mb-1">Share Code</h3>
            <p className="text-helper text-text-secondary">
              Receiver speaks, chats, or shows the code to the sender.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-4 rounded-button bg-bg-elevated/50 border border-border-subtle/50">
            <div className="w-8 h-8 rounded-full bg-accent-primary text-bg-base font-bold flex items-center justify-center mb-3">
              3
            </div>
            <h3 className="font-semibold text-body text-text-primary mb-1">Sender Sends</h3>
            <p className="text-helper text-text-secondary">
              Sender types in the code, receiver accepts, and data streams peer-to-peer.
            </p>
          </div>
        </div>
      </section>

      {/* Reserved Ad Slot below the fold (AD-1) */}
      <AdSlot height="100px" />
    </div>
  );
}
