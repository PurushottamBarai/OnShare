import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdSlot from '../components/AdSlot.jsx';

export default function HowItWorks() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: t('howItWorks.faq1Q', 'Is there any file size limit on OnShare?'),
      a: t('howItWorks.faq1A', 'On Chromium-based browsers (Chrome, Edge, Brave, Opera), OnShare utilizes the File System Access API to stream incoming chunks straight to disk. This enables transfers of up to 40 GB per file with zero browser memory exhaustion. On browsers without File System Access API (such as iOS Safari), files are assembled in memory up to 2 GB.')
    },
    {
      q: t('howItWorks.faq2Q', 'Do my files or text pass through your servers?'),
      a: t('howItWorks.faq2A', 'No. Content never touches our servers. The signaling server is only used to exchange connection metadata (SDP offers and ICE candidates) to establish the direct WebRTC peer-to-peer connection. Once connected, your files and live text move directly between devices encrypted with DTLS and SCTP.')
    },
    {
      q: t('howItWorks.faq3Q', 'What is the difference between Direct Mode and Broadcast Mode?'),
      a: t('howItWorks.faq3A', 'In Direct Mode (Reversed OTP), the receiver generates a 6-digit code and the sender enters it, guaranteeing that the sender approves every transfer. In Broadcast Mode, the sender generates a code and up to 50 receivers can connect and download the files simultaneously.')
    },
    {
      q: t('howItWorks.faq4Q', 'Does OnShare work across different networks and Wi-Fi?'),
      a: t('howItWorks.faq4A', 'Yes! OnShare works across local Wi-Fi networks as well as across the internet (e.g., from home to office or phone cellular data to desktop). WebRTC automatically negotiates direct peer-to-peer paths through NAT and firewalls using STUN/TURN traversal.')
    },
    {
      q: t('howItWorks.faq5Q', 'Do I need to install an app or register an account?'),
      a: t('howItWorks.faq5A', 'Zero installation and zero accounts. OnShare runs 100% inside any modern web browser on Android, iOS, Windows, macOS, and Linux without downloading software or giving away personal email addresses.')
    }
  ];

  return (
    <main className="flex-1 flex flex-col w-full bg-bg-base">
      <div className="relative w-full bg-gradient-to-r from-accent-hover to-accent-primary py-20 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-bg-base tracking-wide">
          {t('howItWorks.title')}
        </h1>
        <p className="mt-3 text-white text-sm sm:text-base max-w-lg mx-auto px-4">
          {t('howItWorks.subtitle')}
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

      <div className="w-full max-w-5xl mx-auto px-6 py-14 sm:py-16 space-y-12">
        {/* Step-by-Step Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-2xl bg-bg-surface border border-border-subtle flex flex-col items-center text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-xl">
              1
            </div>
            <h2 className="text-h2 text-text-primary">{t('howItWorks.step1Title')}</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('howItWorks.step1Desc')}
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-bg-surface border border-border-subtle flex flex-col items-center text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-xl">
              2
            </div>
            <h2 className="text-h2 text-text-primary">{t('howItWorks.step2Title')}</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('howItWorks.step2Desc')}
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-bg-surface border border-border-subtle flex flex-col items-center text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-xl">
              3
            </div>
            <h2 className="text-h2 text-text-primary">{t('howItWorks.step3Title')}</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('howItWorks.step3Desc')}
            </p>
          </div>
        </div>

        {/* Video Tutorial Section */}
        <div className="p-6 sm:p-10 rounded-2xl bg-bg-surface border border-border-subtle shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-primary/10 text-accent-primary mb-2">
                {t('howItWorks.videoBadge', 'Step-by-Step Video Guide')}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
                {t('howItWorks.videoTitle', 'Watch How to Transfer Files & Share Live Text')}
              </h2>
            </div>
            <a
              href="https://youtu.be/q4J69bw37ok"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-sm font-semibold transition-colors self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
              <span>{t('howItWorks.watchOnYouTube', 'Open on YouTube')}</span>
            </a>
          </div>

          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/5 border border-border-subtle shadow-inner">
            <iframe
              className="absolute inset-0 w-full h-full"
              src="https://www.youtube-nocookie.com/embed/q4J69bw37ok?rel=0"
              title="OnShare Tutorial - How to Transfer Files and Live Text"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          <p className="text-sm text-text-secondary leading-relaxed">
            {t('howItWorks.videoDesc', 'This visual tutorial demonstrates pairing devices with 6-digit OTP codes, streaming gigabyte files directly to disk, and real-time live text collaboration without installation or cloud uploads.')}
          </p>
        </div>

        {/* Technical Architecture & Protocols */}
        <div className="p-8 sm:p-12 rounded-2xl bg-bg-surface border border-border-subtle space-y-8 text-sm text-text-secondary leading-relaxed shadow-sm">
          <div className="border-b border-border-subtle pb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">{t('howItWorks.archTitle')}</h2>
            <p className="mt-2 text-text-secondary">
              {t('howItWorks.archSubtitle', 'Learn how OnShare securely brokers peer-to-peer data channels without saving bytes to disk or database.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-primary" />
                {t('howItWorks.arch1Title')}
              </h3>
              <p>{t('howItWorks.arch1Desc')}</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-primary" />
                {t('howItWorks.arch2Title')}
              </h3>
              <p>{t('howItWorks.arch2Desc')}</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-primary" />
                {t('howItWorks.arch3Title')}
              </h3>
              <p>{t('howItWorks.arch3Desc')}</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-primary" />
                {t('howItWorks.arch4Title', 'End-to-End Encryption (DTLS & SCTP)')}
              </h3>
              <p>
                {t('howItWorks.arch4Desc', 'All DataChannels enforce native Datagram Transport Layer Security (DTLS). Eavesdroppers on public Wi-Fi or relay networks cannot decipher transferred contents or file metadata.')}
              </p>
            </section>
          </div>
        </div>

        {/* Frequently Asked Questions */}
        <div className="p-8 sm:p-12 rounded-2xl bg-bg-surface border border-border-subtle space-y-6 shadow-sm">
          <div className="border-b border-border-subtle pb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
              {t('howItWorks.faqTitle', 'Frequently Asked Questions')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {t('howItWorks.faqSubtitle', 'Everything you need to know about security, transfer speeds, and device compatibility.')}
            </p>
          </div>

          <div className="divide-y divide-border-subtle">
            {faqs.map((faq, index) => (
              <div key={index} className="py-4">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full flex justify-between items-center text-left font-semibold text-text-primary hover:text-accent-primary transition-colors cursor-pointer"
                >
                  <span className="text-base">{faq.q}</span>
                  <span className="ml-4 text-xl font-bold text-accent-primary">
                    {openFaq === index ? '−' : '+'}
                  </span>
                </button>
                {openFaq === index && (
                  <p className="mt-3 text-sm text-text-secondary leading-relaxed pr-8">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <AdSlot height="100px" className="mt-8" />
      </div>
    </main>
  );
}
