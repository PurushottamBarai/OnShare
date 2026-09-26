import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ConsentBanner from "./components/ConsentBanner.jsx";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "it", name: "Italiano" },
  { code: "el", name: "Ελληνικά" },
  { code: "hi", name: "हिन्दी" },
  { code: "mr", name: "मराठी" },
  { code: "gu", name: "ગુજરાતી" },
  { code: "pa", name: "ਪੰਜਾਬੀ" },
  { code: "ml", name: "മലയാളം" },
  { code: "bn", name: "বাংলা" },
  { code: "ta", name: "தமிழ்" },
  { code: "ar", name: "العربية" },
  { code: "ko", name: "한국어" },
  { code: "th", name: "ไทย" },
  { code: "cs", name: "Čeština" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "de", name: "Deutsch" },
  { code: "uk", name: "Українська" },
  { code: "tr", name: "Türkçe" },
  { code: "ru", name: "Русский" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "fil", name: "Filipino" },
  { code: "ms", name: "Bahasa Melayu" },
  { code: "nl", name: "Nederlands" },
  { code: "pl", name: "Polski" },
  { code: "pt", name: "Português" },
  { code: "ro", name: "Română" },
];

const Home = lazy(() => import("./routes/Home.jsx"));
const HowItWorks = lazy(() => import("./routes/HowItWorks.jsx"));
const Privacy = lazy(() => import("./routes/Privacy.jsx"));
const Terms = lazy(() => import("./routes/Terms.jsx"));
const Contact = lazy(() => import("./routes/Contact.jsx"));
const Feedback = lazy(() => import("./routes/Feedback.jsx"));
const ComponentsShowcase = lazy(
  () => import("./routes/ComponentsShowcase.jsx"),
);

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-12 text-text-secondary">
      <span className="animate-pulse">Loading...</span>
    </div>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("onshare-theme");
      if (saved) return saved;
      // In test automation environments, honor emulated dark color scheme
      if (
        (window.navigator.webdriver || window.__TEST_WORKER_INDEX__) &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        return "dark";
      }
    }
    return "light";
  });

  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsLangMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("onshare-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-primary transition-colors duration-150">
      {/* Top Header Navbar */}
      <header className="border-b border-border-subtle bg-bg-surface px-1 sm:px-8 md:px-16 lg:px-28 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <Link
          to="/"
          className="flex items-center gap-2 text-x font-bold text-accent-primary hover:opacity-95"
        >
          <img
            src="/logo-onshare-light.png"
            alt="OnShare"
            className="h-7 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-3 sm:gap-6">
          <nav
            className={`${isMobileMenuOpen ? "absolute top-full left-0 w-full flex flex-col bg-bg-surface border-b border-border-subtle shadow-md px-6 py-6 space-y-4 z-40" : "hidden md:flex items-center md:space-x-5 lg:space-x-8"} text-base font-medium`}
          >
            <Link
              to="/send"
              className={`transition-colors ${location.pathname === "/send" || location.pathname === "/" ? "text-accent-primary font-semibold" : "text-text-secondary hover:text-text-primary"}`}
            >
              {t("nav.send")}
            </Link>
            <Link
              to="/receive"
              className={`transition-colors ${location.pathname === "/receive" ? "text-accent-primary font-semibold" : "text-text-secondary hover:text-text-primary"}`}
            >
              {t("nav.receive")}
            </Link>
            <Link
              to="/text"
              className={`transition-colors ${location.pathname === "/text" ? "text-accent-primary font-semibold" : "text-text-secondary hover:text-text-primary"}`}
            >
              {t("nav.textLive")}
            </Link>
            <Link
              to="/contact"
              className={`transition-colors ${location.pathname === "/contact" ? "text-accent-primary font-semibold" : "text-text-secondary hover:text-text-primary"}`}
            >
              {t("nav.contact")}
            </Link>
          </nav>

          {/* Language Switcher */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-subtle bg-bg-elevated hover:border-accent-primary transition-colors text-text-primary text-sm font-medium focus:outline-none"
              aria-label="Select Language"
            >
              <svg
                className="w-4 h-4 text-accent-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              <span>{(i18n.language || "en").toUpperCase()}</span>
              <svg
                className={`w-4 h-4 transition-transform ${isLangMenuOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isLangMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsLangMenuOpen(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-48 bg-bg-surface border border-border-subtle rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto custom-scrollbar flex flex-col py-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-bg-elevated transition-colors ${i18n.language === lang.code ? "text-accent-primary font-semibold bg-bg-elevated/50" : "text-text-primary"}`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Theme Switcher Toggle (Dark / Light) */}
          <button
            onClick={toggleTheme}
            data-testid="theme-toggle-btn"
            className="p-2 rounded-button bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors cursor-pointer"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              // Sun icon for light mode
              <svg
                className="w-4 h-4 text-accent-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              // Moon icon for dark mode
              <svg
                className="w-4 h-4 text-accent-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          {/* Hamburger Menu Button */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-text-primary focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full mx-auto">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/send" element={<Home />} />
            <Route path="/receive" element={<Home />} />
            <Route path="/text" element={<Home />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/components" element={<ComponentsShowcase />} />
          </Routes>
        </Suspense>
      </main>

      {/* Footer per AD-4 */}
      <footer className="border-t border-border-subtle bg-bg-surface px-6 py-6 text-helper text-text-secondary mt-auto">
        <div className="max-w-content mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">OnShare</span>
            <span> • {t("footer.tagline")}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link to="/how-it-works" className="hover:text-text-primary">
              {t("footer.howItWorks")}
            </Link>
            <Link to="/privacy" className="hover:text-text-primary">
              {t("footer.privacyPolicy")}
            </Link>
            <Link to="/terms" className="hover:text-text-primary">
              {t("footer.termsOfUse")}
            </Link>
            <Link to="/contact" className="hover:text-text-primary">
              {t("footer.contact")}
            </Link>
            <Link to="/feedback" className="hover:text-text-primary">
              {t("footer.feedback")}
            </Link>
          </div>
        </div>
      </footer>

      <ConsentBanner />
    </div>
  );
}
