import React, { useState, useEffect, useRef } from 'react';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { ReceiverSink } from '../transfer/receiverSink.js';
import { useTranslation } from 'react-i18next';
import { setTransferStatus } from '../utils/transferState.js';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DashboardReceive({ onTextSessionActive }) {
  const { t } = useTranslation();
  const [code, setCode] = useState(null);
  const [receiverState, setReceiverState] = useState('CONNECTING');
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [manifest, setManifest] = useState(null);

  const [transferProgress, setTransferProgress] = useState({ percent: 0, bytesReceived: 0, totalSize: 0, speedBps: 0, timeRemainingSec: 0 });
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const isJoiningRef = useRef(false);
  const joinTimeoutRef = useRef(null);

  const signalingRef = useRef(null);
  const peerManagerRef = useRef(null);
  const receiverSinkRef = useRef(null);
  const receiverStateRef = useRef(receiverState);

  const updateReceiverState = (newState) => {
    receiverStateRef.current = newState;
    setReceiverState(newState);
  };

  useEffect(() => {
    receiverStateRef.current = receiverState;
  }, [receiverState]);

  const initReceiver = (forceNew = false) => {
    cleanup();
    updateReceiverState('CONNECTING');
    setErrorMessage(null);
    setManifest(null);
    setTransferProgress({ percent: 0, bytesReceived: 0, totalSize: 0, speedBps: 0, timeRemainingSec: 0 });

    let cachedCode = null;
    if (!forceNew && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = sessionStorage.getItem('onshare_receiver_code');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.code && parsed?.expiresAt && Date.now() < parsed.expiresAt) {
            cachedCode = parsed.code;
          } else {
            sessionStorage.removeItem('onshare_receiver_code');
          }
        }
      } catch {
        void 0;
      }
    }

    const client = new SignalingClient();
    signalingRef.current = client;

    client.on('receiver.created', (payload) => {
      setCode(payload.code);
      updateReceiverState('WAITING');
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('onshare_receiver_code', JSON.stringify({
            code: payload.code,
            expiresAt: payload.expiresAt,
          }));
        }
      } catch {
        void 0;
      }
    });

    client.on('receiver.matched', (payload) => {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      setIsJoining(false);
      isJoiningRef.current = false;
      setJoinError(null);
      updateReceiverState('MATCHED');

      peerManagerRef.current = new PeerManager({
        peerId: 'sender',
        role: 'receiver',
        iceServers: payload.iceServers,
        signalingClient: client,
        onManifest: (manifestData) => {
          setManifest(manifestData);
          updateReceiverState('AWAITING_ACCEPT');
        },
        onControlMessage: () => {},
        onStateChange: (state) => {
          const current = receiverStateRef.current;
          if (current === 'DONE' || current === 'DECLINED' || current === 'TEXT_ACTIVE') {
            return;
          }
          if (state === 'DECLINED') updateReceiverState('DECLINED');
          if (state === 'FAILED') {
            updateReceiverState('FAILED');
            setErrorMessage('Connection was interrupted or closed by the sender. Please try again.');
          }
        },
      });
      peerManagerRef.current.init();
    });

    client.on('signal', (msg) => {
      peerManagerRef.current?.handleSignal(msg);
    });

    client.on('session.closed', (payload) => {
      const current = receiverStateRef.current;
      if (current !== 'DONE' && current !== 'DECLINED' && current !== 'TEXT_ACTIVE' && current !== 'TRANSFERRING') {
        updateReceiverState('FAILED');
        setErrorMessage(payload.reason === 'sender_ended' ? 'Sender ended the session.' : 'Sender disconnected.');
      }
    });

    client.on('error', (payload) => {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      if (isJoiningRef.current) {
        setIsJoining(false);
        isJoiningRef.current = false;
        setJoinError(payload.message || 'Invalid or expired code');
        return;
      }
      updateReceiverState('FAILED');
      setErrorMessage(payload.message || 'An error occurred.');
    });

    client.connectReceiver({ resumeCode: cachedCode });
  };

  const cleanup = () => {
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    receiverSinkRef.current?.cancel();
    receiverSinkRef.current = null;
    if (peerManagerRef.current) {
      peerManagerRef.current.onStateChange = null;
      peerManagerRef.current.close();
      peerManagerRef.current = null;
    }
    signalingRef.current?.close();
    signalingRef.current = null;
  };

  const initReceiverRef = useRef(initReceiver);
  useEffect(() => {
    initReceiverRef.current = initReceiver;
  });

  useEffect(() => {
    initReceiverRef.current();
    return cleanup;
  }, []);

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      void 0;
    }
  };

  const handleRegenerate = () => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem('onshare_receiver_code');
      }
    } catch {
      void 0;
    }
    signalingRef.current?.regenerateCode();
    initReceiver(true);
  };

  const handleJoinBroadcast = (e) => {
    e.preventDefault();
    const cleanCode = joinCode.replace(/\D/g, '');
    if (cleanCode.length !== 6 || isJoining) return;
    setJoinError(null);
    setIsJoining(true);
    isJoiningRef.current = true;

    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
    }
    joinTimeoutRef.current = setTimeout(() => {
      if (isJoiningRef.current) {
        setIsJoining(false);
        isJoiningRef.current = false;
        setJoinError('Connecting timed out. Please check the code and ensure the sender is active.');
      }
    }, 10000);

    if (!signalingRef.current || signalingRef.current.socket?.readyState > 1) {
      initReceiver();
    }
    signalingRef.current?.joinBroadcast(cleanCode);
  };

  const handleAccept = async () => {
    if (!peerManagerRef.current || receiverSinkRef.current) return;

    if (manifest?.mode === 'text') {
      peerManagerRef.current.acceptTransfer();
      updateReceiverState('TEXT_ACTIVE');

      const pm = peerManagerRef.current;
      const notifyTextSession = () => {
        if (onTextSessionActive) {
          onTextSessionActive(pm);
        }
      };

      if (pm.textChannel) {
        notifyTextSession();
      } else {
        const poll = setInterval(() => {
          if (pm.textChannel) {
            clearInterval(poll);
            notifyTextSession();
          }
        }, 20);
        setTimeout(() => clearInterval(poll), 10000);
      }
      return;
    }

    const pm = peerManagerRef.current;
    const startTransfer = () => {
      const sink = new ReceiverSink({
        manifest,
        controlChannel: pm.controlChannel,
        dataChannel: pm.dataChannel,
        onProgress: (p) => {
          setTransferProgress(p);
          setTransferStatus({ isActive: true, role: 'receiver', progress: p.percent });
        },
        onComplete: () => {
          updateReceiverState('DONE');
          setTransferStatus({ isActive: false, role: 'receiver', progress: 100 });
          try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
              sessionStorage.removeItem('onshare_receiver_code');
            }
          } catch {
            void 0;
          }
          if (peerManagerRef.current) {
            peerManagerRef.current.onStateChange = null;
            peerManagerRef.current.close();
            peerManagerRef.current = null;
          }
        },
        onError: (err) => {
          updateReceiverState('FAILED');
          setTransferStatus({ isActive: false, role: 'receiver' });
          setErrorMessage(err.message || 'File transfer failed');
        },
      });
      receiverSinkRef.current = sink;

      sink.initFileSystemTarget().then(() => {
        pm.acceptTransfer();
        updateReceiverState('TRANSFERRING');
      });
    };

    if (pm.dataChannel) {
      startTransfer();
    } else {
      const poll = setInterval(() => {
        if (pm.dataChannel) {
          clearInterval(poll);
          startTransfer();
        }
      }, 20);
      setTimeout(() => clearInterval(poll), 10000);
    }
  };

  const handleDecline = () => {
    peerManagerRef.current?.declineTransfer();
    updateReceiverState('DECLINED');
  };

  return (
    <div className="flex flex-col space-y-3.5">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2 font-bold uppercase text-text-primary text-sm tracking-wide">
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{t('nav.receive')}</span>
        </div>
        <span className="text-xs text-text-secondary font-medium">{t('dashboard.yourReceiveCode')}</span>
      </div>

      {(receiverState === 'WAITING' || receiverState === 'CONNECTING') && (
        <div className="space-y-3">
          <div className="w-full py-4 px-4 rounded-xl border border-border-subtle bg-bg-surface flex flex-col items-center justify-center shadow-sm">
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2.5">
              {t('dashboard.enterSenderCode', 'Enter code from sender')}
            </span>
            <form onSubmit={handleJoinBroadcast} className="flex flex-col items-center w-full max-w-xs">
              <div className="flex w-full">
                <input
                  type="text"
                  maxLength={8}
                  value={joinCode}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^\d\s-]/g, '');
                    if (clean.replace(/\D/g, '').length <= 6) {
                      setJoinCode(clean);
                    }
                    setJoinError(null);
                  }}
                  placeholder="Enter the code"
                  disabled={isJoining}
                  className="flex-1 px-4 py-2.5 rounded-l bg-bg-elevated border border-r-0 border-border-subtle focus:border-accent-primary text-text-primary font-mono text-sm tracking-widest placeholder:tracking-normal placeholder:font-sans focus:outline-none text-center"
                />
                <button
                  type="submit"
                  aria-label={t('dashboard.receiveBtn', 'Receive')}
                  disabled={joinCode.replace(/\D/g, '').length !== 6 || isJoining}
                  className="px-4 py-2.5 rounded-r border border-l-0 border-accent-primary bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-bg-base font-semibold text-xs flex items-center justify-center transition-colors cursor-pointer"
                >
                  {isJoining ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                </button>
              </div>
              {isJoining && (
                <p className="text-xs text-accent-primary mt-2 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-primary inline-block" />
                  Connecting to sender...
                </p>
              )}
              {joinError && <p className="text-xs text-status-error mt-1.5 text-center">{joinError}</p>}
            </form>
          </div>

          <div className="relative flex py-0.5 items-center">
            <div className="flex-grow border-t border-border-subtle"></div>
            <span className="flex-shrink mx-3 text-xs text-text-secondary font-medium lowercase">
              {t('dashboard.orSenderConnects', 'or')}
            </span>
            <div className="flex-grow border-t border-border-subtle"></div>
          </div>

          <div className="w-full py-4 rounded-xl border border-border-subtle bg-bg-surface flex flex-col items-center justify-center shadow-sm">
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
              {t('dashboard.yourDirectCode', 'Your direct receive code')}
            </span>
            <div className="text-3xl font-mono font-bold tracking-[0.4em] text-accent-primary mb-3 ml-3 select-all">
              {code ? `${code.slice(0, 3)} ${code.slice(3)}` : '------'}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleRegenerate}
                className="px-3.5 py-1.5 rounded text-xs font-medium bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Regenerate
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  copied
                    ? 'bg-status-success/15 border-status-success/40 text-status-success'
                    : 'bg-bg-elevated border-border-subtle hover:border-accent-primary text-text-primary'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-status-success">Copied</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiverState !== 'WAITING' && receiverState !== 'CONNECTING' && (
        <div className="flex-1">
        {receiverState === 'MATCHED' && (
          <div className="w-full p-6 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex flex-col items-center justify-center space-y-3.5 text-center">
            <div className="relative flex items-center justify-center w-12 h-12">
              <span className="absolute w-12 h-12 rounded-full bg-slate-400/20 dark:bg-slate-400/15 animate-ping" />
              <span className="absolute w-8 h-8 rounded-full bg-slate-400/30 dark:bg-slate-400/25 animate-pulse" />
              <span className="relative w-4 h-4 rounded-full bg-slate-500 dark:bg-slate-400 shadow-[0_0_12px_rgba(100,116,139,0.5)] dark:shadow-[0_0_12px_rgba(148,163,184,0.5)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Connecting with sender...
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Negotiating secure peer connection
              </p>
            </div>
            <button
              type="button"
              onClick={handleDecline}
              className="text-xs px-3 py-1.5 rounded bg-bg-elevated hover:bg-bg-elevated/80 border border-border-subtle text-text-secondary hover:text-status-error transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {receiverState === 'AWAITING_ACCEPT' && (
          manifest ? (
            <div className="w-full p-4 rounded-lg bg-bg-surface border border-border-subtle shadow-sm flex flex-col gap-3">
              <div className="flex flex-col items-center justify-center py-1 gap-0.5">
                {manifest.mode === 'text' ? (
                  <p className="text-base font-semibold text-text-primary tracking-wide">Live Text Session</p>
                ) : (
                  <p className="text-base font-semibold text-text-primary tracking-wide">
                    {manifest.files?.length || 0} file{(manifest.files?.length || 0) !== 1 ? 's' : ''} • {formatBytes(manifest.totalSize)}
                  </p>
                )}
                {manifest.senderLabel && (
                  <p className="text-xs text-text-secondary">{manifest.senderLabel}</p>
                )}
              </div>
              {manifest.totalSize > 2 * 1024 * 1024 * 1024 && !(typeof window !== 'undefined' && 'showSaveFilePicker' in window) && (
                <div className="text-xs p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-text-secondary leading-relaxed">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Large File Notice:</span>{' '}
                  {t('dashboard.largeFileNotice', 'This transfer exceeds 2GB. Desktop Chrome, Edge, or Brave is recommended for direct-to-disk saving to prevent browser memory limits.')}
                </div>
              )}
              <div className="flex gap-2">
                <button data-testid="receive-decline-btn" onClick={handleDecline} className="flex-1 py-1.5 rounded text-sm font-medium bg-bg-elevated border border-border-subtle text-text-primary hover:text-status-error transition-colors cursor-pointer">
                  {t('common.decline')}
                </button>
                <button data-testid="receive-accept-btn" onClick={handleAccept} className="flex-1 py-1.5 rounded text-sm font-medium bg-accent-primary text-bg-base hover:bg-accent-hover transition-colors cursor-pointer">
                  {t('common.accept')}
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full p-6 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-accent-primary/20 border-t-accent-primary animate-spin" />
              <p className="text-xs text-text-secondary">Waiting for transfer details...</p>
            </div>
          )
        )}

        {receiverState === 'TEXT_ACTIVE' && (
          <div className="w-full p-5 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex flex-col items-center justify-center space-y-3 text-center">
            <div className="flex items-center gap-2 text-status-success font-semibold text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse" />
              Live Text Session Active
            </div>
            <p className="text-xs text-text-secondary">Connected with sender. Switch to the Text Live tab to chat.</p>
            <button
              type="button"
              onClick={() => initReceiver(true)}
              className="text-xs px-3.5 py-1.5 rounded bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary transition-colors cursor-pointer"
            >
              End Session
            </button>
          </div>
        )}

        {receiverState === 'TRANSFERRING' && (
          <div className="w-full p-4 rounded-lg bg-bg-surface border border-border-subtle shadow-sm space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-text-primary">Receiving files...</span>
              <span className="font-mono text-accent-primary">{transferProgress.percent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-bg-elevated overflow-hidden">
              <div className="h-full bg-accent-primary transition-all duration-150" style={{ width: `${Math.min(100, transferProgress.percent)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span>{formatBytes(transferProgress.speedBps)}/s</span>
              <span>{formatBytes(transferProgress.bytesReceived)} / {formatBytes(transferProgress.totalSize)}</span>
            </div>
          </div>
        )}

        {receiverState === 'DONE' && (
          <div className="w-full p-4 rounded-lg bg-status-success/10 border border-status-success shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              <span className="text-sm font-medium text-status-success">Transfer Complete</span>
            </div>
            <button onClick={() => initReceiver(true)} className="text-xs px-3 py-1 rounded bg-bg-surface border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer">
              Reset
            </button>
          </div>
        )}

        {(receiverState === 'FAILED' || receiverState === 'EXPIRED' || receiverState === 'DECLINED') && (
          <div className="w-full p-4 rounded-lg bg-status-error/10 border border-status-error shadow-sm flex items-start justify-between gap-3">
             <div className="flex items-start gap-2.5 text-status-error flex-1 min-w-0">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{receiverState === 'DECLINED' ? 'Declined' : 'Connection Notice'}</span>
                  {errorMessage && receiverState === 'FAILED' && (
                    <span className="text-xs opacity-90 mt-1 leading-relaxed text-text-primary/90">{errorMessage}</span>
                  )}
                </div>
             </div>
             <button onClick={initReceiver} className="text-xs px-3 py-1.5 rounded bg-bg-surface border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer text-text-primary flex-shrink-0 self-center">
              Retry
            </button>
          </div>
        )}

        {!['MATCHED', 'AWAITING_ACCEPT', 'TEXT_ACTIVE', 'TRANSFERRING', 'DONE', 'FAILED', 'EXPIRED', 'DECLINED'].includes(receiverState) && (
          <div className="w-full p-6 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex flex-col items-center justify-center space-y-3 text-center">
            <p className="text-sm font-medium text-text-primary">Session in progress</p>
            <button
              type="button"
              onClick={() => initReceiver(true)}
              className="text-xs px-3 py-1.5 rounded bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary transition-colors cursor-pointer"
            >
              Reset Session
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
