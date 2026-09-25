import React, { useRef } from 'react';
import DashboardSend from '../components/DashboardSend.jsx';
import DashboardReceive from '../components/DashboardReceive.jsx';
import DashboardText from '../components/DashboardText.jsx';

export default function Home() {
  const textSessionRef = useRef(null);
  const [activeTab, setActiveTab] = React.useState('send');
  
  // When a receiver accepts a text session, we pass the PeerManager over to the Text component
  // so it can hook up the Yjs session to the established data channels.
  const handleTextSessionActive = (peerManager) => {
    if (textSessionRef.current) {
      textSessionRef.current.connectReceiverPeer(peerManager);
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div data-testid="route-dashboard" className="w-full p-6 sm:p-10 flex justify-start items-start min-h-[calc(100vh-120px)]">
      {/* 
        Unified Dashboard - Single Card Layout.
        Aligned to the north-west to leave room for ad banners on the right/bottom.
      */}
      <div className="w-full max-w-[480px] bg-bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col">
        
        <div className="px-6 py-4 border-b border-border-subtle bg-bg-elevated">
          <div className="flex w-full bg-bg-base rounded border border-border-subtle overflow-hidden font-medium text-sm">
            <button 
              onClick={() => handleTabClick('send')}
              className={`flex-1 px-4 py-2 transition-colors cursor-pointer ${activeTab === 'send' ? 'bg-accent-primary text-bg-base font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'}`}
            >
              Send
            </button>
            <button 
              onClick={() => handleTabClick('receive')}
              className={`flex-1 px-4 py-2 transition-colors cursor-pointer border-l border-r border-border-subtle ${activeTab === 'receive' ? 'bg-accent-primary text-bg-base font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'}`}
            >
              Receive
            </button>
            <button 
              onClick={() => handleTabClick('text')}
              className={`flex-1 px-4 py-2 transition-colors cursor-pointer ${activeTab === 'text' ? 'bg-accent-primary text-bg-base font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'}`}
            >
              Text Live
            </button>
          </div>
        </div>
        
        {/* Single Card View */}
        <div className="flex flex-col relative transition-all duration-300">
          
          {activeTab === 'send' && (
            <div className="p-6 sm:p-8 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
              <DashboardSend />
            </div>
          )}
          
          {activeTab === 'receive' && (
            <div className="p-6 sm:p-8 flex flex-col bg-bg-base/30 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <DashboardReceive onTextSessionActive={handleTextSessionActive} />
            </div>
          )}
          
          {activeTab === 'text' && (
            <div className="p-6 sm:p-8 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
              <DashboardText ref={textSessionRef} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
