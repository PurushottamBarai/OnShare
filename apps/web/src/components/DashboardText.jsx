import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { TextSession, MAX_TEXT_CHARACTERS } from '../text/TextSession.js';
import { generateDeviceLabel } from '../utils/deviceLabel.js';
import { useTranslation } from 'react-i18next';
import { setTransferStatus } from '../utils/transferState.js';

const DashboardText = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [canEdit, setCanEdit] = useState(true);
  const [validity] = useState(60);
  const [, setSessionActive] = useState(false);
  const [, setSessionId] = useState(null);
  const [codeEntry, setCodeEntry] = useState('');
  const [, setReceivers] = useState([]);
  const [codeError, setCodeError] = useState(null);
  const [textLimitWarning, setTextLimitWarning] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [deviceLabel] = useState(() => generateDeviceLabel().fullLabel);
  const [mode, setMode] = useState('sender'); // 'sender' | 'receiver'
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [broadcastCode, setBroadcastCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const signalingRef = useRef(null);
  const peerManagersRef = useRef(new Map());
  const textSessionRef = useRef(null);
  const textareaRef = useRef(null);

  useImperativeHandle(ref, () => ({
    connectReceiverPeer: (pm) => {
      // Destroy the sender session before switching to receiver mode
      if (textSessionRef.current) {
        textSessionRef.current.destroy();
        textSessionRef.current = null;
      }
      const session = new TextSession({
        role: 'receiver',
        onTextChange: (newText) => setText(newText),
        onPermissionChange: (allowed) => setCanEdit(allowed),
      });
      textSessionRef.current = session;
      session.addPeer('sender', pm.textChannel, pm.controlChannel);
      setMode('receiver');
      setTransferStatus({ isActive: true, role: 'text', details: 'Live Text' });
    }
  }));

  useEffect(() => {
    if (mode === 'receiver') return; // Receiver session is managed by connectReceiverPeer
    if (textSessionRef.current) return; // Already initialized

    const session = new TextSession({
      role: 'sender',
      onTextChange: (newText) => setText(newText),
      onPermissionChange: (perm) => setCanEdit(perm),
    });
    session.canEdit = true;
    textSessionRef.current = session;

    return () => {
      if (textSessionRef.current && textSessionRef.current.role === 'sender') {
        textSessionRef.current.destroy();
        textSessionRef.current = null;
      }
    };
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (textSessionRef.current) {
        textSessionRef.current.destroy();
        textSessionRef.current = null;
      }
    };
  }, []);

  const ensureSession = () => {
    if (mode === 'receiver') return;
    if (signalingRef.current) return;

    const client = new SignalingClient();
    signalingRef.current = client;

    client.on('session.created', (payload) => {
      setSessionId(payload.sessionId);
      setSessionActive(true);
    });

    client.on('session.broadcastCreated', (payload) => {
      setBroadcastCode(payload.code);
    });

    client.on('session.receiverMatched', (payload) => {
      const { receiverId } = payload;
      setCodeEntry('');
      setCodeError(null);
      setReceivers(prev => [...prev.filter(r => r.id !== receiverId), { id: receiverId }]);

      const pm = new PeerManager({
        peerId: receiverId,
        role: 'sender',
        iceServers: client.iceServers,
        signalingClient: client,
        onChannelsReady: ({ textChannel, controlChannel }) => {
          if (textSessionRef.current) {
            textSessionRef.current.addPeer(receiverId, textChannel, controlChannel);
            setTransferStatus({ isActive: true, role: 'text', details: 'Live Text' });
          }
        },
      });
      peerManagersRef.current.set(receiverId, pm);
      pm.init({ transferId: `text_${Date.now()}`, mode: 'text', senderLabel: deviceLabel, totalSize: 0, files: [] });
    });

    client.on('signal', (msg) => {
      const from = msg.payload?.from;
      const pm = from && peerManagersRef.current.get(from);
      pm?.handleSignal(msg);
    });

    client.on('peer.left', (payload) => {
      if (textSessionRef.current) textSessionRef.current.removePeer(payload.peerId);
      setReceivers(prev => {
        const updated = prev.filter(r => r.id !== payload.peerId);
        if (updated.length === 0) {
          setTransferStatus({ isActive: false });
        }
        return updated;
      });
    });

    client.on('error', (payload) => {
      if (payload.code === 'RATE_LIMITED') {
        setLockoutSeconds(payload.retryAfter || 60);
        setCodeError('Too many attempts.');
      } else {
        setCodeError(payload.message || 'Error');
      }
    });

    client.connectSender({ validity, mode: 'text' });
  };

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCodeError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  useEffect(() => {
    const peerManagers = peerManagersRef.current;
    return () => {
      peerManagers.forEach(pm => pm.close());
      signalingRef.current?.close();
    };
  }, []);

  const handleTextChange = (e) => {
    let val = e.target.value;
    if (val.length > MAX_TEXT_CHARACTERS) {
      val = val.slice(0, MAX_TEXT_CHARACTERS);
      setTextLimitWarning(true);
    } else {
      setTextLimitWarning(false);
    }
    setText(val);
    if (textSessionRef.current) textSessionRef.current.replaceText(val);
    if (isBroadcast && broadcastCode) {
      signalingRef.current?.invalidateBroadcast();
      setBroadcastCode(null);
    }
    if (mode === 'sender') ensureSession();
  };

  // Auto-resize textarea up to max-height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleToggleEdit = (allowed) => {
    setCanEdit(allowed);
    if (mode === 'sender' && textSessionRef.current) {
      textSessionRef.current.setReceiverCanEdit(allowed);
    }
  };

  const handleCopyAll = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore error */
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OnShare-Text-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleAddReceiver = (e) => {
    e.preventDefault();
    if (!codeEntry || codeEntry.length !== 6 || lockoutSeconds > 0) return;
    setCodeError(null);
    ensureSession();
    signalingRef.current?.addReceiver(codeEntry);
  };

  const handleStartBroadcast = () => {
    if (!text || text.trim().length === 0) {
      setCodeError(t('dashboard.enterTextFirst', 'Please enter some text to send'));
      return;
    }
    setCodeError(null);
    ensureSession();
    signalingRef.current?.createBroadcastCode();
  };

  const handleRegenerateBroadcast = () => {
    ensureSession();
    signalingRef.current?.regenerateBroadcast();
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2 font-bold uppercase text-text-primary text-sm tracking-wide">
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>{t('nav.textLive')}</span>
        </div>

        {/* Broadcast Mode Toggle positioned between Text Live and Allow Edit */}
        {mode === 'sender' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-secondary select-none">
              {t('dashboard.broadcastMode', 'Broadcast Mode')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isBroadcast}
              onClick={() => {
                setIsBroadcast(prev => !prev);
                setBroadcastCode(null);
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                isBroadcast ? 'bg-accent-primary border-accent-primary' : 'bg-bg-elevated border-border-subtle'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-bg-base shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isBroadcast ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={canEdit}
              disabled={mode === 'receiver'}
              onChange={(e) => handleToggleEdit(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-accent-primary focus:ring-accent-primary border-border-subtle cursor-pointer disabled:opacity-50"
            />
            <span>Allow edit</span>
          </label>
          <button onClick={handleCopyAll} title="Copy All" className="text-text-secondary hover:text-accent-primary transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <button onClick={handleDownloadTxt} title="Download .txt" className="text-text-secondary hover:text-accent-primary transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 border border-border-subtle rounded-xl bg-bg-surface overflow-hidden shadow-sm">
        <textarea
          ref={textareaRef}
          value={text}
          disabled={!canEdit && mode === 'receiver'}
          onChange={handleTextChange}
          placeholder={mode === 'receiver' && !canEdit ? t('dashboard.waitingForSender') : t('dashboard.typeOrPasteText')}
          className="w-full flex-1 min-h-[200px] max-h-[500px] p-4 bg-transparent text-text-primary font-mono text-sm leading-relaxed resize-none focus:outline-none"
        />
        <div className="px-4 py-2 bg-bg-elevated border-t border-border-subtle flex justify-between items-center text-[10px] uppercase font-bold text-text-secondary tracking-wide">
          <span>{t('dashboard.liveNotepad', 'Live Notepad')}</span>
          <div className="flex items-center gap-3">
            <span>{text.length.toLocaleString()} / {MAX_TEXT_CHARACTERS.toLocaleString()}</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-status-success"></span> Sync on</span>
          </div>
        </div>
      </div>

      {textLimitWarning && (
        <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              {t(
                'dashboard.textLimitNotice',
                'Maximum text limit reached (500,000 characters). For larger documents, please use the Send Files tab (up to 35GB).'
              )}
            </span>
          </div>
          <button 
            type="button" 
            onClick={() => setTextLimitWarning(false)}
            className="text-text-secondary hover:text-text-primary ml-2 font-bold text-sm leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {mode === 'sender' && (
        <div className="mt-auto flex flex-col w-full">
          {/* If broadcast is toggled ON */}
          {isBroadcast ? (
            broadcastCode ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated border border-border-subtle">
                <span className="text-xl font-mono font-bold tracking-widest text-accent-primary select-all">
                  {broadcastCode}
                </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerateBroadcast}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-bg-surface hover:bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Regenerate</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(broadcastCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded bg-accent-primary hover:bg-accent-hover text-bg-base font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied</span>
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
            ) : (
              <button
                type="button"
                onClick={handleStartBroadcast}
                className="w-full py-2.5 px-4 rounded bg-accent-primary hover:bg-accent-hover text-bg-base font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <span>Send</span>
                <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )
          ) : (
            <form onSubmit={handleAddReceiver} className="flex flex-col w-full">
              <div className="flex w-full">
                <input
                  type="text"
                  maxLength={6}
                  value={codeEntry}
                  onChange={(e) => setCodeEntry(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('dashboard.receiverCode')}
                  disabled={lockoutSeconds > 0}
                  className="flex-1 px-4 py-2.5 rounded-l bg-bg-elevated border border-r-0 border-border-subtle focus:border-accent-primary text-text-primary font-mono text-sm tracking-widest placeholder:tracking-normal placeholder:font-sans focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={codeEntry.length !== 6 || lockoutSeconds > 0}
                  className="px-4 py-2.5 rounded-r border border-l-0 border-accent-primary bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-bg-base flex items-center justify-center transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 transform rotate-90 -ml-0.5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              {codeError && <p className="text-xs text-status-error mt-2">{codeError}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
});

DashboardText.displayName = 'DashboardText';
export default DashboardText;
