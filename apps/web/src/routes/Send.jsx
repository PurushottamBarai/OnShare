import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { generateDeviceLabel } from '../utils/deviceLabel.js';
import StatusPill from '../components/StatusPill.jsx';
import DeviceLabelChip from '../components/DeviceLabelChip.jsx';
import LockoutBanner from '../components/LockoutBanner.jsx';
import AdSlot from '../components/AdSlot.jsx';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function Send() {
  const [files, setFiles] = useState([]);
  const [validity, setValidity] = useState(60); // Default 60 min / "Until done"
  const [sessionActive, setSessionActive] = useState(false);
  const [, setSessionId] = useState(null);
  const [codeEntry, setCodeEntry] = useState('');
  const [receivers, setReceivers] = useState([]); // [{ id, label, status: 'connecting' | 'waiting' | 'sending' | 'done' | 'declined' | 'failed' }]
  const [codeError, setCodeError] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [deviceLabel] = useState(() => generateDeviceLabel().fullLabel);

  const signalingRef = useRef(null);
  const peerManagersRef = useRef(new Map()); // receiverId -> PeerManager
  const fileInputRef = useRef(null);
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Initialize sender session when files are selected or session starts
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

      // Initialize WebRTC PeerManager for this receiver using current files ref
      const currentFiles = filesRef.current;
      const manifest = {
        transferId: `transfer_${Date.now()}`,
        senderLabel: deviceLabel,
        totalSize: currentFiles.reduce((acc, f) => acc + f.size, 0),
        files: currentFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
      };

      const pm = new PeerManager({
        peerId: receiverId,
        role: 'sender',
        iceServers: client.iceServers,
        signalingClient: client,
        onStateChange: (state) => {
          setReceivers(prev => prev.map(r => {
            if (r.id !== receiverId) return r;
            if (state === 'WAITING_ACCEPT') return { ...r, status: 'waiting' };
            if (state === 'ACCEPTED') return { ...r, status: 'sending' };
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

    client.connectSender({ validity, mode: 'files' });
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

  // Tab Title status update (SN-8)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (sessionActive && receivers.length > 0) {
      document.title = `[${receivers.length} receivers] Sending — SharePort`;
    } else if (sessionActive) {
      document.title = `[Session Active] Ready to Send — SharePort`;
    } else {
      document.title = `SharePort - Send Files`;
    }
    return () => {
      document.title = 'SharePort - Direct Browser File & Live Text Sharing';
    };
  }, [sessionActive, receivers.length]);

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

  // File selection handling (SN-1, SN-2)
  const handleFileSelect = (event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 0) {
      setFiles(prev => [...prev, ...selected]);
      ensureSession();
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const dropped = Array.from(event.dataTransfer?.files || []);
    if (dropped.length > 0) {
      setFiles(prev => [...prev, ...dropped]);
      ensureSession();
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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
    setFiles([]);
  };

  const totalFileSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div data-testid="route-send" className="w-full max-w-content mx-auto py-8 px-4 space-y-8">
      {/* Header and Switcher to Text (SN-1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-h1 text-text-primary">Send Files</h1>
          <p className="text-helper text-text-secondary">
            Files stream browser-to-browser with end-to-end encryption.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DeviceLabelChip name={deviceLabel.split(',')[0]} browser={deviceLabel.split(',')[1]?.trim()} />
          <Link
            to="/text"
            className="text-xs font-semibold px-3 py-1.5 rounded-button bg-bg-surface border border-border-subtle hover:border-accent-primary text-text-secondary hover:text-text-primary"
          >
            Switch to Share Text
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
            <span><strong>Keep this tab open</strong> until your transfers finish. Content streams live.</span>
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

      {/* Drop Zone Card (SN-1, SN-2) */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        data-testid="file-drop-zone"
        className="w-full p-8 rounded-card border-2 border-dashed border-border-subtle hover:border-accent-primary bg-bg-surface/50 text-center transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-input"
        />

        <div className="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        <p className="font-semibold text-body text-text-primary">
          Drag and drop files here, or <span className="text-accent-primary underline">browse</span>
        </p>
        <p className="text-helper text-text-secondary mt-1">
          No file size limit. Multi-file selections are automatically packaged into a streamed ZIP.
        </p>
      </div>

      {/* Selected Files List (SN-2) */}
      {files.length > 0 && (
        <div data-testid="selected-files-list" className="p-4 rounded-card bg-bg-surface border border-border-subtle space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="font-semibold text-sm text-text-primary">
              Selected Files ({files.length})
            </span>
            <span className="font-mono text-sm font-medium text-accent-primary">
              Total: {formatBytes(totalFileSize)}
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-button bg-bg-elevated border border-border-subtle text-sm">
                <div className="flex items-center gap-2 truncate pr-2">
                  <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate text-text-primary">{file.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-mono text-xs text-text-secondary">{formatBytes(file.size)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    className="w-5 h-5 rounded flex items-center justify-center text-text-secondary hover:text-status-error hover:bg-bg-base cursor-pointer"
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Validity Selector Chip Group (SN-3) */}
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
      )}

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
                  <StatusPill status={r.status} />
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
