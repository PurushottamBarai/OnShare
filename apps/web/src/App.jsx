import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ConsentBanner from './components/ConsentBanner.jsx';

const Home = lazy(() => import('./routes/Home.jsx'));
const Send = lazy(() => import('./routes/Send.jsx'));
const Receive = lazy(() => import('./routes/Receive.jsx'));
const Text = lazy(() => import('./routes/Text.jsx'));
const HowItWorks = lazy(() => import('./routes/HowItWorks.jsx'));
const Privacy = lazy(() => import('./routes/Privacy.jsx'));
const Terms = lazy(() => import('./routes/Terms.jsx'));
const Contact = lazy(() => import('./routes/Contact.jsx'));
const ReportAbuse = lazy(() => import('./routes/ReportAbuse.jsx'));
const ComponentsShowcase = lazy(() => import('./routes/ComponentsShowcase.jsx'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-12 text-text-secondary">
      <span className="animate-pulse">Loading...</span>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shareport-theme');
      if (saved) return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  });

  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('shareport-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-primary transition-colors duration-150">
      {/* Top Header Navbar */}
      <header className="border-b border-border-subtle bg-bg-surface px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-accent-primary hover:opacity-95">
          <div className="w-8 h-8 rounded-card bg-accent-primary flex items-center justify-center text-bg-base font-extrabold text-sm">
            SP
          </div>
          <span className="tracking-tight">SharePort</span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-6">
          <nav className="flex items-center space-x-2 sm:space-x-4 text-sm font-medium text-text-secondary">
            <Link
              to="/send"
              className={`px-2.5 py-1.5 rounded-button hover:text-text-primary hover:bg-bg-elevated ${location.pathname === '/send' ? 'text-accent-primary' : ''}`}
            >
              Send
            </Link>
            <Link
              to="/receive"
              className={`px-2.5 py-1.5 rounded-button hover:text-text-primary hover:bg-bg-elevated ${location.pathname === '/receive' ? 'text-accent-primary' : ''}`}
            >
              Receive
            </Link>
            <Link
              to="/text"
              className={`px-2.5 py-1.5 rounded-button hover:text-text-primary hover:bg-bg-elevated ${location.pathname === '/text' ? 'text-accent-primary' : ''}`}
            >
              Text
            </Link>
            <Link
              to="/components"
              className={`hidden sm:inline-block px-2.5 py-1.5 rounded-button hover:text-text-primary hover:bg-bg-elevated ${location.pathname === '/components' ? 'text-accent-primary' : ''}`}
            >
              Components
            </Link>
          </nav>

          {/* Theme Switcher Toggle (Dark / Light) */}
          <button
            onClick={toggleTheme}
            data-testid="theme-toggle-btn"
            className="p-2 rounded-button bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors cursor-pointer"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              // Sun icon for light mode
              <svg className="w-4 h-4 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              // Moon icon for dark mode
              <svg className="w-4 h-4 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full mx-auto">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/send" element={<Send />} />
            <Route path="/receive" element={<Receive />} />
            <Route path="/text" element={<Text />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/report-abuse" element={<ReportAbuse />} />
            <Route path="/components" element={<ComponentsShowcase />} />
          </Routes>
        </Suspense>
      </main>

      {/* Footer per AD-4 */}
      <footer className="border-t border-border-subtle bg-bg-surface px-6 py-6 text-helper text-text-secondary mt-auto">
        <div className="max-w-content mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">SharePort</span>
            <span>— OTP-verified browser file and live text sharing.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link to="/how-it-works" className="hover:text-text-primary">How It Works</Link>
            <Link to="/privacy" className="hover:text-text-primary">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-text-primary">Terms of Use</Link>
            <Link to="/contact" className="hover:text-text-primary">Contact</Link>
            <Link to="/report-abuse" className="hover:text-text-primary">Report Abuse</Link>
            <Link to="/components" className="hover:text-accent-primary">Design System</Link>
          </div>
        </div>
      </footer>

      {/* Ad & Cookie Consent Prompt (AD-3) */}
      <ConsentBanner />
    </div>
  );
}
