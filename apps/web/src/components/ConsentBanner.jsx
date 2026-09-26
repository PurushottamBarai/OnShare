import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * ConsentBanner Component (PRD AD-3)
 * Prompts user for advertising and cookie consent where required.
 * Persists choice in localStorage. Never obscures core transfer controls or code display.
 */
export default function ConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const consent = localStorage.getItem('onshare-consent');
      if (!consent) {
        setVisible(true);
      }
    }
  }, []);

  const handleChoice = (accepted) => {
    localStorage.setItem('onshare-consent', accepted ? 'accepted' : 'rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="consent-banner"
      className="fixed bottom-0 inset-x-0 z-40 p-4 bg-bg-elevated/95 backdrop-blur border-t border-border-subtle shadow-2xl transition-all animate-in fade-in"
      role="dialog"
      aria-label="Privacy and Advertising Consent"
    >
      <div className="max-w-content mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-text-secondary leading-relaxed">
          <p className="font-semibold text-text-primary text-sm mb-0.5">
            {t('consent.title')}
          </p>
          <span>
            {t('consent.message')}
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={() => handleChoice(false)}
            data-testid="consent-reject-btn"
            className="px-3.5 py-1.5 text-xs font-medium rounded-button bg-bg-surface border border-border-subtle hover:border-accent-primary text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          >
            {t('consent.decline')}
          </button>
          <button
            onClick={() => handleChoice(true)}
            data-testid="consent-accept-btn"
            className="px-4 py-1.5 text-xs font-semibold rounded-button bg-accent-primary hover:bg-accent-hover text-bg-base cursor-pointer shadow-sm transition-colors"
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
