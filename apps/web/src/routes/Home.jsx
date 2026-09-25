import React, { useRef } from 'react';
import DashboardSend from '../components/DashboardSend.jsx';
import DashboardReceive from '../components/DashboardReceive.jsx';
import DashboardText from '../components/DashboardText.jsx';

export default function Home() {
  const textSessionRef = useRef(null);

  // When a receiver accepts a text session, we pass the PeerManager over to the Text component
  // so it can hook up the Yjs session to the established data channels.
  const handleTextSessionActive = (peerManager) => {
    if (textSessionRef.current) {
      textSessionRef.current.connectReceiverPeer(peerManager);
    }
  };

  return (
    <div data-testid="route-dashboard" className="w-full max-w-[1400px] mx-auto py-6 sm:py-10 px-4">
      {/* 
        Unified Dashboard replacing the 3 separate routes.
        Theme: Matches the existing slate/amber-accent theme (bg-bg-surface, accent-primary, etc.)
      */}
      <div className="w-full bg-bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header matching FluxShare screenshot */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-elevated gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-text-primary text-bg-base flex items-center justify-center">
              <svg className="w-5 h-5 text-bg-base" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <span className="font-bold text-text-primary uppercase tracking-widest text-sm">FLUXSHARE</span>
            <span className="text-[10px] font-bold px-2 py-0.5 border border-border-subtle rounded text-text-secondary uppercase">P2P</span>
          </div>
          
          <div className="text-[10px] font-bold text-text-secondary tracking-widest uppercase flex items-center gap-4">
            <span className="hidden sm:inline">Active Action State:</span>
            <div className="flex bg-bg-base rounded border border-border-subtle overflow-hidden font-medium">
              <span className="px-4 py-1.5 bg-text-primary text-bg-base cursor-default">Send</span>
              <span className="px-4 py-1.5 hover:bg-bg-elevated cursor-default border-l border-r border-border-subtle">Receive</span>
              <span className="px-4 py-1.5 hover:bg-bg-elevated cursor-default">Text Live</span>
            </div>
          </div>
        </div>
        
        {/* 3 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
          
          {/* Col 1: Send */}
          <div className="p-6 sm:p-8 flex flex-col">
            <DashboardSend />
          </div>
          
          {/* Col 2: Receive */}
          <div className="p-6 sm:p-8 flex flex-col bg-bg-base/30">
            <DashboardReceive onTextSessionActive={handleTextSessionActive} />
          </div>
          
          {/* Col 3: Text Live */}
          <div className="p-6 sm:p-8 flex flex-col">
            <DashboardText ref={textSessionRef} />
          </div>

        </div>
      </div>
    </div>
  );
}
