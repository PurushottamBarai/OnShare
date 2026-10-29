import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function Contact() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setLoading(true);
    setStatus(null);
    setErrorMessage('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), message: message.trim() }),
      });
      if (!res.ok) throw new Error('Contact request failed');
      setStatus('success');
      setName('');
      setMessage('');
    } catch {
      setStatus('error');
      setErrorMessage(t('feedbackPage.networkError', 'Network error. Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main data-testid="route-contact" className="flex-1 flex flex-col w-full bg-bg-base">
      <div className="relative w-full bg-gradient-to-r from-accent-hover to-accent-primary py-20 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-bg-base tracking-wide">
          {t('contactPage.title', 'Contact Us')}
        </h1>
        <p className="mt-3 text-white text-sm sm:text-base max-w-lg mx-auto px-4">
          Have questions or need assistance? Reach out to us directly.
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

      <div className="w-full max-w-2xl mx-auto px-6 py-12 sm:py-16 space-y-8">
        <div className="text-text-primary text-base sm:text-lg leading-relaxed">
          <p className="mb-2">
            {t('contactPage.desc1', 'Have questions or need help with OnShare or our services? Use email:')}{' '}
            <a
              href="mailto:contact@onshare.me"
              className="text-accent-primary hover:underline font-medium"
            >
              contact@onshare.me
            </a>
          </p>
          <p className="text-sm text-text-secondary">
            {t('contactPage.desc2', 'or send us a direct message using the form below and we will be in touch with you as quickly as possible.')}
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-8 text-center animate-fade-in shadow-sm">
            <div className="w-14 h-14 mx-auto mb-4 bg-status-success/20 rounded-full flex items-center justify-center text-status-success">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              Message Sent!
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Thank you for reaching out. We have received your message and will get back to you soon.
            </p>
            <button
              type="button"
              onClick={() => setStatus(null)}
              className="px-6 py-2.5 rounded-button bg-bg-elevated border border-border-subtle text-text-primary font-medium text-sm hover:border-accent-primary transition-colors cursor-pointer shadow-sm"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {status === 'error' && (
                <div className="flex items-start gap-3 p-3.5 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2"
                >
                  Your Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-bg-elevated text-text-primary rounded-button border border-border-subtle focus:outline-none focus:border-accent-primary text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-bold text-text-secondary uppercase tracking-wider"
                  >
                    Your Message
                  </label>
                  <span className="text-[11px] text-text-secondary font-mono">
                    {message.length} / 2000
                  </span>
                </div>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  maxLength={2000}
                  placeholder="How can we help you?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-bg-elevated text-text-primary rounded-button border border-border-subtle focus:outline-none focus:border-accent-primary resize-y min-h-[120px] text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim() || !message.trim()}
                className="w-full py-3.5 px-6 rounded-button bg-accent-primary text-bg-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 transform rotate-45 -ml-1 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
