import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { TextSession, MAX_TEXT_CHARACTERS } from '../text/TextSession.js';
import { generateDeviceLabel } from '../utils/deviceLabel.js';
import StatusPill from '../components/StatusPill.jsx';
import DeviceLabelChip from '../components/DeviceLabelChip.jsx';
import LockoutBanner from '../components/LockoutBanner.jsx';
import AdSlot from '../components/AdSlot.jsx';

export default function Text() {
  const [text, setText] = useState('');
  const [canEdit, setCanEdit] = useState(true); // Default true per PRD section 13
  const [validity, setValidity] = useState(60); // Default 60 min / "Until done"
  const [sessionActive, setSessionActive] = useState(false);
  const [, setSessionId] = useState(null);
  const [codeEntry, setCodeEntry] = useState('');
  const [receivers, setReceivers] = useState([]); // [{ id, label, status: 'connecting' | 'waiting' | 'sending' | 'done' | 'declined' | 'failed' }]
  const [codeError, setCodeError] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [deviceLabel] = useState(() => generateDeviceLabel().fullLabel);

  const signalingRef = useRef(null);
  const peerManagersRef = useRef(new Map()); // receiverId -> PeerManager
  const textSessionRef = useRef(null);

  // Initialize sender TextSession master hub on mount
  useEffect(() => {
    const session = new TextSession({
      role: 'sender',
      onTextChange: (newText) => {
        setText(newText);
      },
    });
    session.canEdit = true;
    textSessionRef.current = session;

    return () => {
      session.destroy();
    };
  }, []);

  // Initialize sender signaling session
  const ensureSession = () => {
    if (signalingRef.current && sessionActive) return;

    const client = new SignalingClient();
    signalingRef.current = client;

    client.on('session.created', (payload) => {
      setSessionId(payload.sessionId);
      setSessionActive(true);
    });

    client.on('session.receiverMatched', (payload) => {
      const { receiverId } = payload;
      setCodeEntry('');
      setCodeError(null);

      // Add receiver to UI list
      setReceivers(prev => {
        if (prev.some(r => r.id === receiverId)) return prev;
        return [...prev, { id: receiverId, label: `Receiver (${receiverId.slice(-4)})`, status: 'waiting' }];
      });

      const manifest = {
        transferId: `text_${Date.now()}`,
        mode: 'text',
        senderLabel: deviceLabel,
        totalSize: 0,
        files: [],
      };

      const pm = new PeerManager({
        peerId: receiverId,
        role: 'sender',
        iceServers: client.iceServers,
        signalingClient: client,
        onChannelsReady: ({ textChannel, controlChannel }) => {
          if (textSessionRef.current) {
            textSessionRef.current.addPeer(receiverId, textChannel, controlChannel);
          }
        },
        onStateChange: (state) => {
          setReceivers(prev => prev.map(r => {
            if (r.id !== receiverId) return r;
            if (state === 'WAITING_ACCEPT') return { ...r, status: 'waiting' };
            if (state === 'ACCEPTED') {
              // Channels are established; add to Yjs text session
              if (textSessionRef.current && pm.textChannel && pm.controlChannel) {
                textSessionRef.current.addPeer(receiverId, pm.textChannel, pm.controlChannel);
              }
              return { ...r, status: 'sending' }; // 'sending' in StatusPill shows active connection
            }
            if (state === 'DECLINED') return { ...r, status: 'declined' };
            if (state === 'FAILED') return { ...r, status: 'failed' };
            return r;
          }));
        },
      });

      peerManagersRef.current.set(receiverId, pm);
      pm.init(manifest);
    });

    client.on('signal', (msg) => {
      const from = msg.payload?.from;
      const pm = (from && peerManagersRef.current.get(from)) ||
                 (peerManagersRef.current.size === 1 && Array.from(peerManagersRef.current.values())[0]);
      pm?.handleSignal(msg);
    });

    client.on('peer.left', (payload) => {
      if (textSessionRef.current) {
        textSessionRef.current.removePeer(payload.peerId);
      }
      setReceivers(prev => prev.map(r => {
        if (r.id === payload.peerId) {
          return { ...r, status: 'declined' };
        }
        return r;
      }));
    });

    client.on('error', (payload) => {
      if (payload.code === 'RATE_LIMITED') {
        const wait = payload.retryAfter || 60;
        setLockoutSeconds(wait);
        setCodeError('Too many failed code attempts. Entry locked.');
      } else if (payload.code === 'OTP_INVALID') {
        setCodeError('Invalid code. Please check with receiver.');
      } else if (payload.code === 'OTP_EXPIRED') {
        setCodeError('Code has expired. Receiver must regenerate.');
      } else if (payload.code === 'SESSION_FULL') {
        setCodeError('Session full: maximum 10 receivers reached.');
      } else {
        setCodeError(payload.message || 'Error communicating with signaling server.');
      }
    });

    client.connectSender({ validity, mode: 'text' });
  };

  // Lockout countdown timer
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

  // Tab Title status update
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (sessionActive && receivers.length > 0) {
      document.title = `[${receivers.length} receivers] Live Text — SharePort`;
    } else if (sessionActive) {
      document.title = `[Text Ready] Share Text — SharePort`;
    } else {
      document.title = `SharePort - Share Text`;
    }
    return () => {
      document.title = 'SharePort - Direct Browser File & Live Text Sharing';
    };
  }, [sessionActive, receivers.length]);

  // Warn before leaving if text session is active with receivers (SS-3)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = (e) => {
      if (receivers.length > 0) {
        e.preventDefault();
        e.returnValue = 'Text session is currently active. Leaving will end the session.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [receivers.length]);

  // Initialize session and cleanup on unmount
  useEffect(() => {
    ensureSession();
    const pms = peerManagersRef.current;
    const sig = signalingRef.current;
    return () => {
      pms.forEach(pm => pm.close());
      pms.clear();
      sig?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Text input handler
  const handleTextChange = (e) => {
    const val = e.target.value;
    if (val.length <= MAX_TEXT_CHARACTERS) {
      setText(val);
      if (textSessionRef.current) {
        textSessionRef.current.replaceText(val);
      }
      ensureSession();
    }
  };

  // Toggle edit permissions (TX-2)
  const handleToggleEdit = (allowed) => {
    setCanEdit(allowed);
    if (textSessionRef.current) {
      textSessionRef.current.setReceiverCanEdit(allowed);
    }
  };

  // Copy all & Download .txt (TX-4)
  const handleCopyAll = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SharePort-Text-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Adding receiver code (SN-4, SN-5)
  const handleAddReceiver = (e) => {
    e.preventDefault();
    if (!codeEntry || codeEntry.length !== 6 || lockoutSeconds > 0) return;
    setCodeError(null);
    ensureSession();
    signalingRef.current?.addReceiver(codeEntry);
  };

  // Removing receiver (SN-7)
  const handleRemoveReceiver = (receiverId) => {
    if (textSessionRef.current) {
      textSessionRef.current.removePeer(receiverId);
    }
    signalingRef.current?.removeReceiver(receiverId);
    peerManagersRef.current.get(receiverId)?.close();
    peerManagersRef.current.delete(receiverId);
    setReceivers(prev => prev.filter(r => r.id !== receiverId));
  };

  // End session (SN-7)
  const handleEndSession = () => {
    signalingRef.current?.endSession();
    peerManagersRef.current.forEach(pm => pm.close());
    peerManagersRef.current.clear();
    setSessionActive(false);
    setReceivers([]);
  };

  return (
    <div data-testid="route-text" className="w-full max-w-content mx-auto py-8 px-4 space-y-8">
      {/* Header and Switcher to Send (SN-1, TX-1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-h1 text-text-primary">Share Live Text</h1>
          <p className="text-helper text-text-secondary">
            Real-time collaborative text with conflict-free Yjs CRDT synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DeviceLabelChip name={deviceLabel.split(',')[0]} browser={deviceLabel.split(',')[1]?.trim()} />
          <Link
            to="/send"
            className="text-xs font-semibold px-3 py-1.5 rounded-button bg-bg-surface border border-border-subtle hover:border-accent-primary text-text-secondary hover:text-text-primary"
          >
            Switch to Send Files
          </Link>
        </div>
      </div>

      {/* Persistent Keep Tab Open Banner (SN-8) */}
      {sessionActive && (
        <div data-testid="keep-tab-banner" className="p-3 rounded-button bg-bg-surface border border-status-warning/40 text-sm text-status-warning flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span><strong>Keep this tab open</strong> while sharing text. Updates synchronize live.</span>
          </div>
          <button
            onClick={handleEndSession}
            data-testid="end-session-btn"
            className="text-xs font-semibold px-2.5 py-1 rounded bg-bg-elevated text-status-error hover:bg-status-error/10 border border-status-error/40 cursor-pointer"
          >
            End Session
          </button>
        </div>
      )}

      {/* Lockout Banner (SN-9) */}
      {lockoutSeconds > 0 && (
        <LockoutBanner remainingSeconds={lockoutSeconds} message={codeError || 'Too many failed code attempts.'} />
      )}

      {/* Main Text Editor Card (TX-1, TX-2, TX-4, TX-5) */}
      <div className="p-6 rounded-card bg-bg-surface border border-border-subtle space-y-4 shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border-subtle">
          {/* Edit Toggle for Receivers (TX-2) */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-text-primary flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={canEdit}
                onChange={(e) => handleToggleEdit(e.target.checked)}
                data-testid="allow-edit-toggle"
                className="w-4 h-4 rounded text-accent-primary focus:ring-accent-primary border-border-subtle cursor-pointer"
              />
              <span>Allow receivers to edit</span>
            </label>
            <span className="text-xs text-text-secondary">
              ({canEdit ? 'Collaborative' : 'Sender view-only'})
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              data-testid="copy-all-btn"
              className="px-3 py-1.5 text-xs font-semibold rounded-button bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-secondary hover:text-text-primary cursor-pointer flex items-center gap-1.5"
            >
              {copied ? 'Copied!' : 'Copy All'}
            </button>
            <button
              onClick={handleDownloadTxt}
              data-testid="download-txt-btn"
              className="px-3 py-1.5 text-xs font-semibold rounded-button bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-secondary hover:text-text-primary cursor-pointer"
            >
              Download .txt
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={text}
            onChange={handleTextChange}
            data-testid="shared-text-editor"
            rows={14}
            placeholder="Type or paste text here to share live with connected receivers…"
            className="w-full p-4 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary font-mono text-sm leading-relaxed resize-y focus:outline-none"
          />
          <div className="flex justify-between text-xs text-text-secondary mt-1">
            <span>Plain text only • Never stored on server</span>
            <span data-testid="char-counter">{text.length} / {MAX_TEXT_CHARACTERS}</span>
          </div>
        </div>

        {/* Validity Selector Chip Group (SN-3, PRD 6.3) */}
        <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-text-secondary">Session Validity:</span>
          <div className="flex flex-wrap gap-1.5">
            {[2, 5, 10, 30, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => setValidity(mins)}
                className={`px-2.5 py-1 rounded-pill text-xs font-medium cursor-pointer ${validity === mins ? 'bg-accent-primary text-bg-base font-semibold' : 'bg-bg-elevated text-text-secondary hover:text-text-primary'}`}
              >
                {mins === 60 ? 'Until done (60m)' : `${mins} min`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Code Entry Field & Add Receiver (SN-4, SN-5, SN-9) */}
      <div className="p-6 rounded-card bg-bg-surface border border-border-subtle space-y-4">
        <div>
          <h2 className="text-h2 text-text-primary">Add Receiver</h2>
          <p className="text-helper text-text-secondary">
            Ask the receiver for their 6-digit access code and enter it below.
          </p>
        </div>

        <form onSubmit={handleAddReceiver} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              maxLength={6}
              value={codeEntry}
              onChange={(e) => setCodeEntry(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit receiver code (e.g. 123456)"
              disabled={lockoutSeconds > 0}
              data-testid="receiver-code-input"
              className="w-full px-4 py-2.5 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary font-mono text-base tracking-widest placeholder:tracking-normal placeholder:font-sans focus:outline-none"
            />
            {codeError && (
              <p data-testid="code-error-text" className="text-xs text-status-error mt-1.5 font-medium">
                {codeError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={codeEntry.length !== 6 || lockoutSeconds > 0}
            data-testid="add-receiver-btn"
            className="px-6 py-2.5 rounded-button font-semibold bg-accent-primary hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-bg-base cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            Add Receiver
          </button>
        </form>
      </div>

      {/* Receiver List & Live Status (SN-5, SN-6, SN-7, SN-10) */}
      {receivers.length > 0 && (
        <div data-testid="receivers-list" className="p-6 rounded-card bg-bg-surface border border-border-subtle space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <h2 className="text-h2 text-text-primary">
              Connected Receivers ({receivers.length} / 10)
            </h2>
            <span className="text-xs text-text-secondary">Cap: 10 max</span>
          </div>

          <div className="space-y-3">
            {receivers.map((r) => (
              <div
                key={r.id}
                data-testid={`receiver-row-${r.id}`}
                className="flex items-center justify-between p-3.5 rounded-button bg-bg-elevated border border-border-subtle"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-xs">
                    R
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-text-primary">{r.label}</p>
                    <p className="text-xs text-text-secondary">ID: {r.id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusPill status={r.status} label={r.status === 'sending' ? 'CONNECTED' : undefined} />
                  <button
                    onClick={() => handleRemoveReceiver(r.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-text-secondary hover:text-status-error hover:bg-bg-base cursor-pointer"
                    title="Remove receiver"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AdSlot height="100px" />
    </div>
  );
}
