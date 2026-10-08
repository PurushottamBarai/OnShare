import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdSlot from '../components/AdSlot.jsx';

export default function Privacy() {
  const { t } = useTranslation();

  const sections = [
    {
      title: t('privacyPage.h1', '1. Your content is never stored.'),
      desc: t(
        'privacyPage.p1',
        'Files, file names and shared text travel directly from one browser to another, encrypted with DTLS. They never reach our servers, so we cannot read, recover or share them with anyone.'
      ),
    },
    {
      title: t('privacyPage.h2', '2. Connection data is temporary.'),
      desc: t(
        'privacyPage.p2',
        'Pairing codes, session identifiers and connection details stay in server memory only. Receive codes last up to 10 minutes, broadcast codes 2, 5 or 30 minutes, and everything is deleted when the session ends.'
      ),
    },
    {
      title: t('privacyPage.h3', '3. Your IP address is visible to the other person.'),
      desc: t(
        'privacyPage.p3',
        'Peer-to-peer connections let the people you connect with see your public IP address. If a direct link fails, an encrypted relay forwards your data and cannot read it. We keep only a hashed IP, and only to prevent abuse.'
      ),
    },
    {
      title: t('privacyPage.h4', '4. No account, and limited storage.'),
      desc: t(
        'privacyPage.p4',
        'You need no account, email or password to send or receive. Your browser keeps only small items such as your language, theme and consent choices, plus your receive code until the tab closes.'
      ),
    },
    {
      title: t('privacyPage.h5', '5. Advertising.'),
      desc: t(
        'privacyPage.p5',
        'OnShare may display ads from third-party advertising partners to help cover running costs. These partners may use cookies to show and measure ads. Ads sit outside the transfer area and never access your files or text.'
      ),
    },
    {
      title: t('privacyPage.h6', '6. Your rights.'),
      desc: t(
        'privacyPage.p6',
        "You can ask to access, correct or delete personal data we hold, such as form messages, or withdraw consent at any time through the Contact page. OnShare is designed to align with the GDPR and India's DPDP Act."
      ),
      hasContactLink: true,
    },
  ];

  return (
    <main className="flex-1 flex flex-col w-full bg-bg-base">
      <div className="relative w-full bg-gradient-to-r from-accent-hover to-accent-primary py-20 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-bg-base tracking-wide">
          {t('privacyPage.title')}
        </h1>
        <p className="mt-3 text-white text-sm sm:text-base max-w-lg mx-auto px-4">
          {t('privacyPage.subtitle')}
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

      <div className="w-full max-w-4xl mx-auto px-6 py-14 sm:py-16">
        <div className="space-y-8 text-sm text-text-secondary leading-relaxed bg-bg-surface p-8 sm:p-12 rounded-2xl border border-border-subtle shadow-sm">
          {sections.map((sec, idx) => (
            <section key={idx} className="space-y-3">
              <h2 className="text-h2 text-text-primary">{sec.title}</h2>
              <p>{sec.desc}</p>
              {sec.hasContactLink && (
                <p className="pt-2">
                  <Link to="/contact" className="text-accent-primary underline hover:text-accent-hover font-semibold">
                    {t('nav.contact')}
                  </Link>
                </p>
              )}
            </section>
          ))}
        </div>

        <AdSlot height="100px" className="mt-8" />
      </div>
    </main>
  );
}
