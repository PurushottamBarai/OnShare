import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import locales
import ar from './locales/ar.json';
import bn from './locales/bn.json';
import cs from './locales/cs.json';
import de from './locales/de.json';
import el from './locales/el.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ml from './locales/ml.json';
import mr from './locales/mr.json';
import ms from './locales/ms.json';
import nl from './locales/nl.json';
import pa from './locales/pa.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';
import ta from './locales/ta.json';
import th from './locales/th.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';

const resources = {
  ar: { translation: ar },
  bn: { translation: bn },
  cs: { translation: cs },
  de: { translation: de },
  el: { translation: el },
  en: { translation: en },
  es: { translation: es },
  fil: { translation: fil },
  fr: { translation: fr },
  gu: { translation: gu },
  hi: { translation: hi },
  id: { translation: id },
  it: { translation: it },
  ja: { translation: ja },
  ko: { translation: ko },
  ml: { translation: ml },
  mr: { translation: mr },
  ms: { translation: ms },
  nl: { translation: nl },
  pa: { translation: pa },
  pl: { translation: pl },
  pt: { translation: pt },
  ro: { translation: ro },
  ru: { translation: ru },
  ta: { translation: ta },
  th: { translation: th },
  tr: { translation: tr },
  uk: { translation: uk },
  vi: { translation: vi },
  zh: { translation: zh }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

// Handle RTL for Arabic
i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('dir', lng === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lng);
});

// Note: i18n is initialized as a side-effect, no export needed
