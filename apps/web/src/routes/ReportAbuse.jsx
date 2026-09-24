import React, { useState } from 'react';
import AdSlot from '../components/AdSlot.jsx';

export default function ReportAbuse() {
  const [codeOrSession, setCodeOrSession] = useState('');
  const [category, setCategory] = useState('malware');
  const [details, setDetails] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!details) return;
    setSubmitted(true);
  };

  return (
    <div data-testid="route-report-abuse" className="w-full max-w-content mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-h1 text-text-primary mb-2">Report Abuse</h1>
        <p className="text-helper text-text-secondary">
          SharePort prohibits malware, unauthorized distribution, and harmful activity. Report violations here.
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-card bg-bg-surface border border-border-subtle shadow-sm max-w-xl mx-auto">
        {submitted ? (
          <div data-testid="report-success" className="text-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-status-success/20 text-status-success flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-h2 text-text-primary">Report Received</h2>
            <p className="text-helper text-text-secondary">
              Thank you for keeping SharePort safe. Our security and compliance team investigates reports immediately.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setCodeOrSession('');
                setCategory('malware');
                setDetails('');
                setReporterEmail('');
              }}
              className="mt-4 px-4 py-2 rounded-button text-xs font-semibold bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary cursor-pointer"
            >
              Submit Another Report
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="abuse-code" className="block text-xs font-semibold text-text-primary mb-1">
                Access Code or Session ID (if known)
              </label>
              <input
                id="abuse-code"
                type="text"
                value={codeOrSession}
                onChange={(e) => setCodeOrSession(e.target.value)}
                placeholder="e.g. 123456 or sess_abc123"
                className="w-full px-3.5 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary text-sm focus:outline-none font-mono"
              />
            </div>

            <div>
              <label htmlFor="abuse-category" className="block text-xs font-semibold text-text-primary mb-1">
                Violation Category
              </label>
              <select
                id="abuse-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary text-sm focus:outline-none"
              >
                <option value="malware">Malware / Virus / Trojan / Ransomware</option>
                <option value="phishing">Phishing or Fraud</option>
                <option value="copyright">Copyright Infringement</option>
                <option value="harassment">Harassment or Threatening Content</option>
                <option value="other">Other Violation</option>
              </select>
            </div>

            <div>
              <label htmlFor="abuse-details" className="block text-xs font-semibold text-text-primary mb-1">
                Description of Violation
              </label>
              <textarea
                id="abuse-details"
                required
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Please describe the file name, sender behavior, or incident details…"
                className="w-full px-3.5 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary text-sm focus:outline-none resize-y"
              />
            </div>

            <div>
              <label htmlFor="abuse-email" className="block text-xs font-semibold text-text-primary mb-1">
                Your Email (optional, for follow-up)
              </label>
              <input
                id="abuse-email"
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="reporter@example.com"
                className="w-full px-3.5 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary text-sm focus:outline-none"
              />
            </div>

            <button
              type="submit"
              data-testid="report-submit-btn"
              className="w-full py-3 rounded-button font-semibold bg-status-error hover:bg-status-error/90 text-white cursor-pointer shadow-sm text-sm"
            >
              Submit Abuse Report
            </button>
          </form>
        )}
      </div>

      <AdSlot height="100px" />
    </div>
  );
}
