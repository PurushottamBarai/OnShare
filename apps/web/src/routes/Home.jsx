import React, { useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardSend from '../components/DashboardSend.jsx';
import DashboardReceive from '../components/DashboardReceive.jsx';
import DashboardText from '../components/DashboardText.jsx';

export default function Home() {
  const { t } = useTranslation();
  const textSessionRef = useRef(null);
  const location = useLocation();
  
  const activeTab = location.pathname === '/receive' ? 'receive' : 
                    location.pathname === '/text' ? 'text' : 'send';
  
  const navigate = useNavigate();
  
  // When a receiver accepts a text session, we pass the PeerManager over to the Text component
  // so it can hook up the Yjs session to the established data channels.
  const handleTextSessionActive = (peerManager) => {
    if (textSessionRef.current) {
      textSessionRef.current.connectReceiverPeer(peerManager);
      navigate('/text');
    }
  };

  return (
    <div data-testid="route-dashboard" className="w-full p-4 sm:p-10 flex flex-col items-start min-h-[calc(100vh-120px)]">
      <div className="w-full max-w-[480px] sm:ml-8 lg:ml-20 flex flex-col gap-4">
        
        <div className="flex bg-bg-surface/60 backdrop-blur-0 rounded-xl border border-gray-100 dark:border-border-subtle/30 shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden font-medium text-sm w-fit self-center">
          <Link 
            to="/send"
            className={`px-6 py-2.5 transition-all duration-300 cursor-pointer ${activeTab === 'send' ? 'bg-accent-primary text-bg-base font-semibold shadow-md scale-105 rounded-xl' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40'}`}
          >
            {t('nav.send')}
          </Link>
          <Link 
            to="/receive"
            className={`px-6 py-2.5 transition-all duration-300 cursor-pointer ${activeTab === 'receive' ? 'bg-accent-primary text-bg-base font-semibold shadow-md scale-105 rounded-xl' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40'}`}
          >
            {t('nav.receive')}
          </Link>
          <Link 
            to="/text"
            className={`px-6 py-2.5 transition-all duration-300 cursor-pointer ${activeTab === 'text' ? 'bg-accent-primary text-bg-base font-semibold shadow-md scale-105 rounded-xl' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40'}`}
          >
            {t('nav.textLive')}
          </Link>
        </div>

        <div className="w-full bg-bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col">
          
          {/* Single Card View */}
        <div className="flex flex-col relative transition-all duration-300">
          
          <div className={`p-6 sm:p-8 flex flex-col ${activeTab === 'send' ? 'block' : 'hidden'}`}>
            <DashboardSend />
          </div>
          
          <div className={`p-6 sm:p-8 flex flex-col bg-bg-base/30 ${activeTab === 'receive' ? 'block' : 'hidden'}`}>
            <DashboardReceive onTextSessionActive={handleTextSessionActive} />
          </div>
          
          <div className={`p-6 sm:p-8 flex flex-col ${activeTab === 'text' ? 'block' : 'hidden'}`}>
            <DashboardText ref={textSessionRef} />
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}
