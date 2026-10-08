import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTransferStatus, subscribeTransferStatus } from '../utils/transferState.js';

export default function ActiveTransferBar() {
  const [status, setStatus] = useState(getTransferStatus());
  const navigate = useNavigate();

  useEffect(() => {
    return subscribeTransferStatus(setStatus);
  }, []);

  if (!status.isActive) return null;

  const targetPath = status.role === 'receiver' ? '/receive' : status.role === 'text' ? '/text' : '/send';
  const label = status.role === 'receiver' ? 'Receiving Files' : status.role === 'text' ? 'Live Text Session' : 'Sending Files';

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-bounce-short sm:w-auto">
      <div className="flex items-center gap-3 bg-bg-surface/95 backdrop-blur-md border border-accent-primary/40 shadow-2xl rounded-2xl p-3.5 px-4 text-text-primary">
        {/* Pulsing indicator */}
        <div className="relative flex items-center justify-center shrink-0">
          <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-accent-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-primary"></span>
        </div>

        <div className="flex flex-col min-w-[130px]">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span>{label}</span>
            {status.role !== 'text' && (
              <span className="text-accent-primary font-bold">{Math.round(status.progress || 0)}%</span>
            )}
            {status.role === 'text' && (
              <span className="text-accent-primary font-bold">Active</span>
            )}
          </div>
          {status.role !== 'text' ? (
            <div className="w-full bg-border-subtle rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className="bg-accent-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, status.progress || 0))}%` }}
              />
            </div>
          ) : (
            <div className="text-[10px] text-text-secondary mt-0.5">Real-time collaboration</div>
          )}
        </div>

        <button
          onClick={() => navigate(targetPath)}
          className="ml-2 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/90 text-bg-base font-semibold text-xs rounded-xl shadow transition-all duration-200 cursor-pointer shrink-0"
        >
          {status.role === 'text' ? 'View Text' : 'View Transfer'}
        </button>
      </div>
    </div>
  );
}
