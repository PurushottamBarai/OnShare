import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Contact() {
  const { t } = useTranslation();
  return (
    <main className="flex-1 flex flex-col w-full bg-bg-base">
      
      {/* Top Banner with OnShare theme and bottom curve */}
      <div className="relative w-full bg-gradient-to-r from-accent-hover to-accent-primary py-20 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-bg-base tracking-wide">
          {t('contactPage.title')}
        </h1>

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

      {/* Simple content area matching reference image */}
      <div className="w-full max-w-3xl mx-auto px-6 py-14 sm:py-16 text-text-primary text-base sm:text-lg leading-relaxed">
        <p className="mb-6 text-text-primary">
          {t('contactPage.desc1')}{' '}
          
          <a
            href="mailto:purushottamx.in@gmail.com"
            className="text-accent-primary hover:underline font-medium"
          >
            purushottamx.in@gmail.com
          </a>
        </p>

        <p className="text-text-primary">
          {t('contactPage.desc2')}
        </p>
      </div>
    </main>
  );
}
