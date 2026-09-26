import React from 'react';
import { useTranslation } from 'react-i18next';

export default function HowItWorks() {
  const { t } = useTranslation();
  return (
    <main className="flex-1 flex flex-col w-full bg-bg-base">
      
      {/* Top Banner with OnShare theme and bottom curve */}
      <div className="relative w-full bg-gradient-to-r from-accent-hover to-accent-primary py-20 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-bg-base tracking-wide">
          {t('howItWorks.title')}
        </h1>
        <p className="mt-3 text-white text-sm sm:text-base max-w-lg mx-auto px-4">
          {t('howItWorks.subtitle')}
        </p>

        {/* Bottom subtle wave curve */}
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

      <div className="w-full max-w-5xl mx-auto px-6 py-14 sm:py-16 space-y-10">
        
        {/* 3 Step Visual Cards */}
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

        {/* Deep Dive Architecture Details */}
        <div className="p-8 sm:p-12 rounded-2xl bg-bg-surface border border-border-subtle space-y-8 text-sm text-text-secondary leading-relaxed shadow-sm">
          <h2 className="text-3xl font-bold text-text-primary">{t('howItWorks.archTitle')}</h2>

          <div className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t('howItWorks.arch1Title')}</h3>
              <p>
                {t('howItWorks.arch1Desc')}
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t('howItWorks.arch2Title')}</h3>
              <p>
                {t('howItWorks.arch2Desc')}
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t('howItWorks.arch3Title')}</h3>
              <p>
                {t('howItWorks.arch3Desc')}
              </p>
            </section>
          </div>
        </div>

      </div>
    </main>
  );
}
