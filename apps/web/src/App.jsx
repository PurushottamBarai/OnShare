import React, { Suspense, lazy } from 'react';
import { Routes, Route, Link } from 'react-router-dom';

const Home = lazy(() => import('./routes/Home.jsx'));
const Send = lazy(() => import('./routes/Send.jsx'));
const Receive = lazy(() => import('./routes/Receive.jsx'));
const Text = lazy(() => import('./routes/Text.jsx'));
const HowItWorks = lazy(() => import('./routes/HowItWorks.jsx'));
const Privacy = lazy(() => import('./routes/Privacy.jsx'));
const Terms = lazy(() => import('./routes/Terms.jsx'));
const Contact = lazy(() => import('./routes/Contact.jsx'));
const ReportAbuse = lazy(() => import('./routes/ReportAbuse.jsx'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-12 text-text-secondary">
      <span className="animate-pulse">Loading...</span>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-primary">
      <header className="border-b border-border-subtle bg-bg-surface px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-accent-primary">
          SharePort
        </Link>
        <nav className="flex space-x-4 text-sm text-text-secondary">
          <Link to="/send" className="hover:text-text-primary">Send</Link>
          <Link to="/receive" className="hover:text-text-primary">Receive</Link>
          <Link to="/text" className="hover:text-text-primary">Text</Link>
          <Link to="/how-it-works" className="hover:text-text-primary">How It Works</Link>
        </nav>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4">
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
          </Routes>
        </Suspense>
      </main>

      <footer className="border-t border-border-subtle bg-bg-surface px-6 py-4 text-xs text-text-secondary flex flex-wrap justify-center gap-4">
        <Link to="/how-it-works" className="hover:text-text-primary">How It Works</Link>
        <Link to="/privacy" className="hover:text-text-primary">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-text-primary">Terms of Use</Link>
        <Link to="/contact" className="hover:text-text-primary">Contact</Link>
        <Link to="/report-abuse" className="hover:text-text-primary">Report Abuse</Link>
      </footer>
    </div>
  );
}
