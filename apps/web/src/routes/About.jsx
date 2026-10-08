import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdSlot from '../components/AdSlot.jsx';

export default function About() {
  const { t } = useTranslation();

  return (
    <main data-testid="route-about" className="flex-1 flex flex-col w-full bg-bg-base">
      {/* Top Banner with OnShare theme and subtle wave */}
      <div className="relative w-full bg-gradient-to-r from-accent-hover to-accent-primary py-20 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-bg-base tracking-wide">
          {t('aboutPage.title', 'About OnShare')}
        </h1>
        <p className="mt-3 text-white text-sm sm:text-base max-w-lg mx-auto px-4">
          {t('aboutPage.subtitle', 'Fast, private, browser-to-browser sharing built for transparency and simplicity.')}
        </p>

        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none pointer-events-none">
          <svg
            className="relative block w-full h-5 sm:h-6 text-bg-base fill-current"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path d="M0,0 C200,60 400,20 600,50 C800,80 1000,30 1200,45 L1200,120 L0,120 Z" />
          </svg>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-6 py-14 sm:py-16 space-y-10 text-text-primary text-base sm:text-lg leading-relaxed">
        {/* Mission Statement */}
        <section className="bg-bg-surface p-8 sm:p-10 rounded-2xl border border-border-subtle shadow-sm space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
            {t('aboutPage.missionTitle', 'Our Mission')}
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            {t(
              'aboutPage.missionDesc',
              'OnShare was created to eliminate the unnecessary friction and privacy risks of modern file transfer services. Why should your personal files, slides, or photos sit on a company’s cloud servers just to share them with a friend or colleague sitting in the same room? We believe file transfer should be as direct, lightweight, and private as handing someone a physical flash drive.'
            )}
          </p>
        </section>

        {/* Core Principles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-bg-surface p-6 sm:p-8 rounded-2xl border border-border-subtle shadow-sm space-y-3">
            
            <h3 className="text-lg font-semibold text-text-primary">
              {t('aboutPage.principle1Title', 'Zero Cloud Storage')}
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              {t(
                'aboutPage.principle1Desc',
                'Your files never touch our hard drives or databases. Data streams directly between peer browsers over encrypted WebRTC data channels with DTLS security.'
              )}
            </p>
          </div>

          <div className="bg-bg-surface p-6 sm:p-8 rounded-2xl border border-border-subtle shadow-sm space-y-3">
            
            <h3 className="text-lg font-semibold text-text-primary">
              {t('aboutPage.principle2Title', 'No Accounts or Passwords')}
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              {t(
                'aboutPage.principle2Desc',
                'No sign-up forms, no email verifications, and no tracking cookies. Pair instantly using short-lived 6-digit one-time access codes that expire automatically.'
              )}
            </p>
          </div>

          <div className="bg-bg-surface p-6 sm:p-8 rounded-2xl border border-border-subtle shadow-sm space-y-3">
            
            <h3 className="text-lg font-semibold text-text-primary">
              {t('aboutPage.principle3Title', 'High Capacity (Up to 40 GB)')}
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              {t(
                'aboutPage.principle3Desc',
                'Transfer single files up to 40 GB directly to disk using the Chromium File System Access API without exhausting browser memory.'
              )}
            </p>
          </div>

          <div className="bg-bg-surface p-6 sm:p-8 rounded-2xl border border-border-subtle shadow-sm space-y-3">
            
            <h3 className="text-lg font-semibold text-text-primary">
              {t('aboutPage.principle4Title', '1-to-1 and Broadcast Sharing')}
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              {t(
                'aboutPage.principle4Desc',
                'Pair with a single receiver using reverse verification, or toggle Broadcast Mode to share files with up to 50 concurrent recipients with one code.'
              )}
            </p>
          </div>
        </div>

        {/* Technology & Open Standards */}
        <section className="bg-bg-surface p-8 sm:p-10 rounded-2xl border border-border-subtle shadow-sm space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            {t('aboutPage.techTitle', 'Built on Open Web Standards')}
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            {t(
              'aboutPage.techDesc',
              'OnShare is powered entirely by modern web standards: WebRTC DataChannels for peer-to-peer transport, Yjs CRDTs for collaborative real-time text synchronization, and ephemeral WebSockets for lightweight discovery signaling. We believe in building sustainable web tools funded ethically by non-intrusive display advertising.'
            )}
          </p>
        </section>

        {/* Contact Callout */}
        <div className="p-6 sm:p-8 rounded-2xl bg-accent-primary/5 border border-accent-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              {t('aboutPage.contactHeading', 'Have questions or suggestions?')}
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              {t('aboutPage.contactSubheading', 'We would love to hear from you. Reach out to our team at any time.')}
            </p>
          </div>
          <Link
            to="/contact"
            className="px-6 py-2.5 rounded-xl bg-accent-primary text-bg-base font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap shadow-sm"
          >
            {t('nav.contact', 'Contact Us')}
          </Link>
        </div>

        <AdSlot height="100px" className="mt-8" />
      </div>
    </main>
  );
}
