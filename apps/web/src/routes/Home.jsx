import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardSend from '../components/DashboardSend.jsx';
import DashboardReceive from '../components/DashboardReceive.jsx';
import DashboardText from '../components/DashboardText.jsx';

function useTypewriter(phrases, { typingSpeed = 75, deletingSpeed = 35, pauseTime = 2200, pauseBeforeNext = 350 } = {}) {
  const [displayText, setDisplayText] = useState(phrases[0] || '');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const phrasesKey = phrases.join('|');

  useEffect(() => {
    setDisplayText(phrases[0] || '');
    setPhraseIndex(0);
    setIsDeleting(false);
  }, [phrasesKey, phrases]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(phrases[phraseIndex % phrases.length] || '');
      return;
    }

    const currentPhrase = phrases[phraseIndex % phrases.length] || '';
    let timer;

    if (!isDeleting) {
      if (displayText.length < currentPhrase.length) {
        timer = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        }, typingSpeed);
      } else {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, pauseTime);
      }
    } else {
      if (displayText.length > 0) {
        timer = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length - 1));
        }, deletingSpeed);
      } else {
        timer = setTimeout(() => {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }, pauseBeforeNext);
      }
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, phraseIndex, phrases, typingSpeed, deletingSpeed, pauseTime, pauseBeforeNext]);

  return displayText || '\u00A0';
}

export default function Home() {
  const { t } = useTranslation();
  const textSessionRef = useRef(null);
  const location = useLocation();

  const typingPhrases = useMemo(() => [
    t('landing.typing1', 'File & Live Text'),
    t('landing.typing2', 'High-Speed File'),
    t('landing.typing3', 'Real-Time Text'),
    t('landing.typing4', 'Large Video & Photo'),
    t('landing.typing5', 'Direct P2P'),
  ], [t]);

  const dynamicText = useTypewriter(typingPhrases);
  
  const activeTab = location.pathname === '/receive' ? 'receive' : 
                    location.pathname === '/text' ? 'text' : 'send';
  
  const navigate = useNavigate();
  
  const handleTextSessionActive = (peerManager) => {
    if (textSessionRef.current) {
      textSessionRef.current.connectReceiverPeer(peerManager);
      navigate('/text');
    }
  };

  return (
    <div data-testid="route-dashboard" className="w-full flex flex-col items-center">
      <section className="w-full px-4 sm:px-8 md:px-16 lg:px-28 py-8 sm:py-12 lg:py-14 flex flex-col lg:flex-row items-center justify-start gap-10 sm:gap-12 lg:gap-14 xl:gap-20 2xl:gap-24">
        <div className="w-full max-w-[480px] flex flex-col gap-4 shrink-0 order-1 lg:order-1">
          <div className="flex bg-bg-surface/60 backdrop-blur-0 rounded-xl border border-gray-100 dark:border-border-subtle/30 shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden font-medium text-sm w-fit self-center">
            <Link 
              to="/send"
              className={`px-6 py-2.5 transition-all duration-300 cursor-pointer ${activeTab === 'send' ? 'bg-accent-primary text-bg-base font-semibold shadow-md scale-105 rounded-xl' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40'}`}
            >
              {t('nav.send')}
            </Link>
            <Link 
              to="/receive"
              className={`px-6 py-2.5 transition-all duration-300 cursor-pointer ${activeTab === 'receive' ? 'bg-accent-primary text-bg-base font-semibold shadow-md scale-105 rounded-xl' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40'}`}
            >
              {t('nav.receive')}
            </Link>
            <Link 
              to="/text"
              className={`px-6 py-2.5 transition-all duration-300 cursor-pointer ${activeTab === 'text' ? 'bg-accent-primary text-bg-base font-semibold shadow-md scale-105 rounded-xl' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40'}`}
            >
              {t('nav.textLive')}
            </Link>
          </div>

          <div className="w-full bg-bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex flex-col relative transition-all duration-300">
              <div className={`p-6 sm:p-8 flex flex-col ${activeTab === 'send' ? 'block' : 'hidden'}`}>
                <DashboardSend />
              </div>
              
              <div className={`p-6 sm:p-8 flex flex-col bg-bg-base/30 ${activeTab === 'receive' ? 'block' : 'hidden'}`}>
                <DashboardReceive onTextSessionActive={handleTextSessionActive} />
              </div>
              
              <div className={`p-6 sm:p-8 flex flex-col ${activeTab === 'text' ? 'block' : 'hidden'}`}>
                <DashboardText ref={textSessionRef} />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:flex-1 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6 max-w-xl xl:max-w-2xl self-center order-2 lg:order-2 py-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/20 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
            <span>{t('landing.heroBadge', '100% Peer-to-Peer • Zero Cloud Storage')}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-text-primary tracking-tight leading-[1.16]">
            {t('landing.heroTitlePrefix', 'Direct Browser-to-Browser')} <br className="hidden sm:inline" />
            <span className="text-accent-primary">
              {dynamicText}
              <span
                className="inline-block w-[2.5px] sm:w-[3.5px] h-[0.85em] bg-accent-primary ml-1.5 align-baseline animate-cursor-blink"
                aria-hidden="true"
              />
            </span>{' '}
            {t('landing.heroTitleSuffix', 'Sharing')}
          </h1>

          <p className="text-base sm:text-lg text-text-secondary leading-relaxed">
            {t('landing.heroDesc', 'Transfer files of any size directly between smartphones, tablets, and computers using end-to-end encrypted WebRTC. No registration, no app downloads, and zero intermediate server storage.')}
          </p>
        </div>
      </section>

      <section id="how-it-works" className="w-full bg-bg-surface border-y border-border-subtle py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
              {t('landing.howItWorksTitle', 'How Peer-to-Peer File Transfer Works')}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto">
              {t('landing.howItWorksSubtitle', 'OnShare replaces slow cloud uploads with direct browser-to-browser channels. Data streams privately between sender and receiver in three simple steps.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-6 rounded-2xl bg-bg-base border border-border-subtle flex flex-col items-center text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-lg">
                1
              </div>
              <h3 className="text-lg font-semibold text-text-primary">
                {t('landing.step1Title', 'Choose Files & Generate Code')}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {t('landing.step1Desc', 'Select your files or paste text into OnShare. A secure, short-lived 6-digit access code is generated instantly to initiate peer discovery.')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-bg-base border border-border-subtle flex flex-col items-center text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-lg">
                2
              </div>
              <h3 className="text-lg font-semibold text-text-primary">
                {t('landing.step2Title', 'Direct P2P Handshake')}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {t('landing.step2Desc', 'The receiver enters the 6-digit code on their device. A lightweight WebSocket signal brokers an encrypted WebRTC connection directly between both browsers.')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-bg-base border border-border-subtle flex flex-col items-center text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-lg">
                3
              </div>
              <h3 className="text-lg font-semibold text-text-primary">
                {t('landing.step3Title', 'Full-Speed Line Streaming')}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {t('landing.step3Desc', 'Files stream directly over SCTP data channels with 64 KiB framing and batched disk writes, completely bypassing intermediate cloud servers.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-16 space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
            {t('landing.comparisonTitle', 'Why Choose Direct P2P Over Cloud Storage?')}
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto">
            {t('landing.comparisonSubtitle', 'Traditional cloud services require uploading your entire file to their servers before a recipient can download it. OnShare creates a direct, real-time pipe.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-2xl bg-bg-surface border border-border-subtle space-y-4 shadow-sm">
            <div className="inline-flex items-center gap-2 text-accent-primary font-semibold text-sm">
              <span>✦</span> {t('landing.comp1Badge', 'Zero Intermediate Cloud Storage')}
            </div>
            <h3 className="text-xl font-bold text-text-primary">
              {t('landing.comp1Title', 'Your Data Never Leaves Your Control')}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('landing.comp1Desc', 'With typical file lockers and email attachments, your personal photos, documents, and recordings are stored on third-party servers, creating data leak risks. OnShare never writes your file data to a server disk or cloud bucket. The moment the transfer finishes, the session terminates.')}
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-bg-surface border border-border-subtle space-y-4 shadow-sm">
            <div className="inline-flex items-center gap-2 text-accent-primary font-semibold text-sm">
              <span>✦</span> {t('landing.comp2Badge', 'No Upload-Then-Download Delay')}
            </div>
            <h3 className="text-xl font-bold text-text-primary">
              {t('landing.comp2Title', 'Simultaneous Real-Time Streaming')}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('landing.comp2Desc', 'In traditional cloud sharing, you must wait 100% of the upload time before sharing a link. With OnShare P2P streaming, the receiver starts downloading the very first byte the moment you click send, cutting total transfer time in half.')}
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-bg-surface border border-border-subtle space-y-4 shadow-sm">
            <div className="inline-flex items-center gap-2 text-accent-primary font-semibold text-sm">
              <span>✦</span> {t('landing.comp3Badge', 'High Capacity Transfers (Up to 40 GB)')}
            </div>
            <h3 className="text-xl font-bold text-text-primary">
              {t('landing.comp3Title', 'Free from Artificial File Size Limits')}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('landing.comp3Desc', 'Most free cloud transfer services cap transfers at 2 GB unless you subscribe to expensive plans. OnShare uses the browser’s native File System Access API to stream files up to 40 GB directly to disk without running out of device RAM.')}
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-bg-surface border border-border-subtle space-y-4 shadow-sm">
            <div className="inline-flex items-center gap-2 text-accent-primary font-semibold text-sm">
              <span>✦</span> {t('landing.comp4Badge', 'Privacy & No Account Required')}
            </div>
            <h3 className="text-xl font-bold text-text-primary">
              {t('landing.comp4Title', 'Instant Access Without Signup Walls')}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('landing.comp4Desc', 'No email registrations, no password managers, and no persistent tracking cookies. Simply open OnShare in any modern browser, share a 6-digit code, and transfer your files immediately.')}
            </p>
          </div>
        </div>
      </section>

      <section className="w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
            {t('landing.faqTitle', 'Frequently Asked Questions')}
          </h2>
          <p className="text-text-secondary text-sm sm:text-base">
            {t('landing.faqSubtitle', 'Everything you need to know about OnShare peer-to-peer file sharing and security.')}
          </p>
        </div>

        <div className="space-y-4">
          <details className="group bg-bg-surface border border-border-subtle rounded-2xl p-6 transition-all shadow-sm open:shadow-md">
            <summary className="font-semibold text-text-primary cursor-pointer list-none flex items-center justify-between text-base">
              <span>{t('landing.faq1Q', 'How does OnShare transfer files without cloud storage?')}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all duration-200 text-text-secondary group-hover:text-text-primary bg-transparent group-hover:bg-black/5 group-open:bg-black/5 dark:group-hover:bg-white/10 dark:group-open:bg-white/10">
                <svg className="w-4 h-4 transform transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {t('landing.faq1A', 'OnShare uses WebRTC (Web Real-Time Communication), an open web standard supported natively by Chromium, Safari, Firefox, and Edge. When sender and receiver connect via a 6-digit pairing code, the signaling server only exchanges connection metadata (ICE candidates). The actual file bytes stream directly between the two browsers through an encrypted peer-to-peer data channel.')}
            </p>
          </details>

          <details className="group bg-bg-surface border border-border-subtle rounded-2xl p-6 transition-all shadow-sm open:shadow-md">
            <summary className="font-semibold text-text-primary cursor-pointer list-none flex items-center justify-between text-base">
              <span>{t('landing.faq2Q', 'Is there a file size limit on OnShare?')}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all duration-200 text-text-secondary group-hover:text-text-primary bg-transparent group-hover:bg-black/5 group-open:bg-black/5 dark:group-hover:bg-white/10 dark:group-open:bg-white/10">
                <svg className="w-4 h-4 transform transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {t('landing.faq2A', 'OnShare supports transferring files up to 40 GB in Chromium-based browsers (Chrome, Edge, Brave, Opera) via the native File System Access API, which writes incoming chunks directly to disk instead of holding them in memory. In browsers where direct disk streaming is restricted, downloads fall back safely to in-memory Blob packaging for files up to available device memory.')}
            </p>
          </details>

          <details className="group bg-bg-surface border border-border-subtle rounded-2xl p-6 transition-all shadow-sm open:shadow-md">
            <summary className="font-semibold text-text-primary cursor-pointer list-none flex items-center justify-between text-base">
              <span>{t('landing.faq3Q', 'Are my files encrypted during transfer?')}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all duration-200 text-text-secondary group-hover:text-text-primary bg-transparent group-hover:bg-black/5 group-open:bg-black/5 dark:group-hover:bg-white/10 dark:group-open:bg-white/10">
                <svg className="w-4 h-4 transform transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {t('landing.faq3A', 'Yes. All WebRTC peer connections are mandatory end-to-end encrypted using DTLS (Datagram Transport Layer Security) with AES-GCM 256-bit cryptography. No third party, internet service provider, or signaling node can inspect, intercept, or tamper with your files in transit.')}
            </p>
          </details>

          <details className="group bg-bg-surface border border-border-subtle rounded-2xl p-6 transition-all shadow-sm open:shadow-md">
            <summary className="font-semibold text-text-primary cursor-pointer list-none flex items-center justify-between text-base">
              <span>{t('landing.faq4Q', 'Can I transfer files between a phone and a computer?')}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all duration-200 text-text-secondary group-hover:text-text-primary bg-transparent group-hover:bg-black/5 group-open:bg-black/5 dark:group-hover:bg-white/10 dark:group-open:bg-white/10">
                <svg className="w-4 h-4 transform transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {t('landing.faq4A', 'Yes! OnShare is 100% browser-based and platform agnostic. You can send files between Windows, macOS, Linux, Android, iOS, iPadOS, or ChromeOS simply by opening onshare.me on both devices and entering the 6-digit code.')}
            </p>
          </details>

          <details className="group bg-bg-surface border border-border-subtle rounded-2xl p-6 transition-all shadow-sm open:shadow-md">
            <summary className="font-semibold text-text-primary cursor-pointer list-none flex items-center justify-between text-base">
              <span>{t('landing.faq5Q', 'Do I need to keep the browser tab open while transferring?')}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all duration-200 text-text-secondary group-hover:text-text-primary bg-transparent group-hover:bg-black/5 group-open:bg-black/5 dark:group-hover:bg-white/10 dark:group-open:bg-white/10">
                <svg className="w-4 h-4 transform transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {t('landing.faq5A', 'Yes. Because OnShare streams data directly from the sender’s browser to the receiver’s browser in real-time, both devices must keep their browser tabs open until the progress bar reaches 100%. Once completed, you can safely close the tabs.')}
            </p>
          </details>

          <details className="group bg-bg-surface border border-border-subtle rounded-2xl p-6 transition-all shadow-sm open:shadow-md">
            <summary className="font-semibold text-text-primary cursor-pointer list-none flex items-center justify-between text-base">
              <span>{t('landing.faq6Q', 'What happens if multiple files or folders are selected?')}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all duration-200 text-text-secondary group-hover:text-text-primary bg-transparent group-hover:bg-black/5 group-open:bg-black/5 dark:group-hover:bg-white/10 dark:group-open:bg-white/10">
                <svg className="w-4 h-4 transform transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {t('landing.faq6A', 'When you select multiple files, OnShare automatically bundles and streams them as an uncompressed ZIP archive on the fly using fflate. The receiver receives a single organized .zip file with all folder hierarchies preserved.')}
            </p>
          </details>

          <details className="group bg-bg-surface border border-border-subtle rounded-2xl p-6 transition-all shadow-sm open:shadow-md">
            <summary className="font-semibold text-text-primary cursor-pointer list-none flex items-center justify-between text-base">
              <span>{t('landing.faq7Q', 'How does live collaborative text sharing work?')}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all duration-200 text-text-secondary group-hover:text-text-primary bg-transparent group-hover:bg-black/5 group-open:bg-black/5 dark:group-hover:bg-white/10 dark:group-open:bg-white/10">
                <svg className="w-4 h-4 transform transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {t('landing.faq7A', 'Under the Text Live tab, OnShare provides a zero-install real-time scratchpad powered by Yjs Conflict-Free Replicated Data Types (CRDTs). You can share meeting notes, code snippets, links, and passwords directly across devices with live bidirectional character synchronization.')}
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
