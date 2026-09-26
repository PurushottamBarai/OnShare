import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Terms() {
  const { t } = useTranslation();
  return (
    <main className="flex-1 flex flex-col w-full bg-bg-base">
      
      {/* Top Banner with OnShare theme and bottom curve */}
      <div className="relative w-full bg-gradient-to-r from-accent-hover to-accent-primary py-20 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-bg-base tracking-wide">
          {t('termsPage.title')}
        </h1>
        <p className="mt-3 text-white text-sm sm:text-base max-w-lg mx-auto px-4">
          {t('termsPage.subtitle')}
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

      {/* Terms Content Area */}
      <div className="w-full max-w-4xl mx-auto px-6 py-14 sm:py-16">
        <div className="space-y-8 text-sm text-text-secondary leading-relaxed bg-bg-surface p-8 sm:p-12 rounded-2xl border border-border-subtle shadow-sm">
          <section className="space-y-3">
            <h2 className="text-h2 text-text-primary">{t('termsPage.h1')}</h2>
            <p>
              {t('termsPage.p1')}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-h2 text-text-primary">{t('termsPage.h2')}</h2>
            <p>
              {t('termsPage.p2')}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-h2 text-text-primary">{t('termsPage.h3')}</h2>
            <p>
              {t('termsPage.p3')}
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{t('termsPage.li1')}</li>
              <li>{t('termsPage.li2')}</li>
              <li>{t('termsPage.li3')}</li>
              <li>{t('termsPage.li4')}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-h2 text-text-primary">{t('termsPage.h4')}</h2>
            <p>
              {t('termsPage.p4')}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
