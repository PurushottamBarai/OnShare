import React, { useState } from 'react';
import AdSlot from '../components/AdSlot.jsx';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setSubmitted(true);
  };

  return (
    <div data-testid="route-contact" className="w-full max-w-content mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-h1 text-text-primary mb-2">Contact Us</h1>
        <p className="text-helper text-text-secondary">
          Questions, partnership inquiries, or technical feedback — we&apos;d love to hear from you.
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-card bg-bg-surface border border-border-subtle shadow-sm max-w-xl mx-auto">
        {submitted ? (
          <div data-testid="contact-success" className="text-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-status-success/20 text-status-success flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-h2 text-text-primary">Message Sent</h2>
            <p className="text-helper text-text-secondary">
              Thank you for reaching out, {name}! Our team will get back to you shortly at {email}.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setName('');
                setEmail('');
                setSubject('');
                setMessage('');
              }}
              className="mt-4 px-4 py-2 rounded-button text-xs font-semibold bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary cursor-pointer"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="contact-name" className="block text-xs font-semibold text-text-primary mb-1">
                Your Name
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3.5 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary text-sm focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-xs font-semibold text-text-primary mb-1">
                Email Address
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3.5 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary text-sm focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="contact-subject" className="block text-xs font-semibold text-text-primary mb-1">
                Subject
              </label>
              <input
                id="contact-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="General Question / Feedback"
                className="w-full px-3.5 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary text-sm focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-xs font-semibold text-text-primary mb-1">
                Message
              </label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                className="w-full px-3.5 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary text-sm focus:outline-none resize-y"
              />
            </div>

            <button
              type="submit"
              data-testid="contact-submit-btn"
              className="w-full py-3 rounded-button font-semibold bg-accent-primary hover:bg-accent-hover text-bg-base cursor-pointer shadow-sm text-sm"
            >
              Submit Message
            </button>
          </form>
        )}
      </div>

      <AdSlot height="100px" />
    </div>
  );
}
