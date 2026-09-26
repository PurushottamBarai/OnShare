import React, { useState, useEffect, useRef } from 'react';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { generateDeviceLabel } from '../utils/deviceLabel.js';
import { SenderPipeline, generateZipFilename } from '../transfer/senderPipeline.js';
import LockoutBanner from './LockoutBanner.jsx';
import { useTranslation } from 'react-i18next';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DashboardSend() {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [validity, setValidity] = useState(30);
  const [, setSessionActive] = useState(false);
  const [, setSessionId] = useState(null);
  const [codeEntry, setCodeEntry] = useState('');
  const [receivers, setReceivers] = useState([]);
  const [codeError, setCodeError] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [deviceLabel] = useState(() => generateDeviceLabel().fullLabel);
  const [isDragging, setIsDragging] = useState(false);

  const signalingRef = useRef(null);
  const peerManagersRef = useRef(new Map());
  const senderPipelinesRef = useRef(new Map());
  const fileInputRef = useRef(null);
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const ensureSession = () => {
    if (signalingRef.current) return;
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
      setReceivers(prev => {
        if (prev.some(r => r.id === receiverId)) return prev;
        return [...prev, { id: receiverId, label: `Receiver (${receiverId.slice(-4)})`, status: 'waiting', progress: 0 }];
      });

      const currentFiles = filesRef.current;
      const isMultiFile = currentFiles.length > 1;
      const manifest = {
        transferId: `transfer_${Date.now()}`,
        mode: 'files',
        senderLabel: deviceLabel,
        totalSize: currentFiles.reduce((acc, f) => acc + (f.size || 0), 0),
        zip: isMultiFile,
        zipFilename: isMultiFile ? generateZipFilename() : undefined,
        files: currentFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
      };

      const pm = new PeerManager({
        peerId: receiverId,
        role: 'sender',
        iceServers: client.iceServers,
        signalingClient: client,
        onControlMessage: (data) => {
          if (data.type === 'complete') {
            setReceivers(prev => prev.map(r => r.id === receiverId ? { ...r, status: 'done', progress: 100 } : r));
          }
        },
        onStateChange: (state) => {
          if (state === 'ACCEPTED') {
            if (!senderPipelinesRef.current.has(receiverId)) {
              const pipeline = new SenderPipeline({
                dataChannel: pm.dataChannel,
                controlChannel: pm.controlChannel,
                files: currentFiles,
                onProgress: (p) => {
                  setReceivers(curr => curr.map(item => item.id === receiverId ? { ...item, status: 'sending', progress: p.percent } : item));
                },
                onComplete: () => {
                  setReceivers(curr => curr.map(item => item.id === receiverId ? { ...item, status: 'done', progress: 100 } : item));
                },
                onError: () => {
                  setReceivers(curr => curr.map(item => item.id === receiverId ? { ...item, status: 'failed' } : item));
                },
              });
              senderPipelinesRef.current.set(receiverId, pipeline);
              pipeline.start();
            }
          }

          setReceivers(prev => prev.map(r => {
            if (r.id !== receiverId) return r;
            if (state === 'WAITING_ACCEPT') return { ...r, status: 'waiting' };
            if (state === 'ACCEPTED') return { ...r, status: 'sending', progress: 0 };
            if (state === 'DECLINED') return { ...r, status: 'declined' };
            if (state === 'FAILED') return { ...r, status: 'failed' };
            if (state === 'DONE') return { ...r, status: 'done', progress: 100 };
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
      setReceivers(prev => prev.map(r => r.id === payload.peerId ? { ...r, status: 'declined' } : r));
    });

    client.on('error', (payload) => {
      if (payload.code === 'RATE_LIMITED') {
        const wait = payload.retryAfter || 60;
        setLockoutSeconds(wait);
        setCodeError('Too many failed code attempts.');
      } else {
        setCodeError(payload.message || 'Error communicating with server.');
      }
    });

    client.connectSender({ validity, mode: 'files' });
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
    const pipelines = senderPipelinesRef.current;
    const peers = peerManagersRef.current;
    const signaling = signalingRef.current;
    return () => {
      pipelines.forEach(p => p.cancel());
      peers.forEach(pm => pm.close());
      signaling?.close();
    };
  }, []);

  const handleFileSelect = (event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 0) {
      setFiles(prev => [...prev, ...selected]);
      ensureSession();
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only reset if dragging leaves the main container, not child elements
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(event.dataTransfer?.files || []);
    if (dropped.length > 0) {
      setFiles(prev => [...prev, ...dropped]);
      ensureSession();
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddReceiver = (e) => {
    e.preventDefault();
    if (!codeEntry || codeEntry.length !== 6 || lockoutSeconds > 0) return;
    setCodeError(null);
    ensureSession();
    signalingRef.current?.addReceiver(codeEntry);
  };

  const totalFileSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div 
      className="flex flex-col h-full space-y-6 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Background dim/blur effect when dragging */}
      {isDragging && (
        <div className="absolute inset-0 -m-8 bg-bg-base/60 backdrop-blur-sm z-10 rounded-xl transition-all duration-300 pointer-events-none" />
      )}

      <div className={`flex justify-between items-center px-1 relative ${isDragging ? 'z-0 opacity-50' : 'z-20'}`}>
        <div className="flex items-center gap-2 font-bold uppercase text-text-primary text-sm tracking-wide">
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>{t('nav.send')}</span>
        </div>
        <span className="text-xs text-text-secondary font-medium">Max 10GB</span>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className={`w-full ${files.length > 0 ? 'h-16' : 'h-48'} rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer relative z-20 ${
          isDragging 
            ? 'border-solid border-accent-primary bg-accent-primary/10 scale-[1.02] shadow-[0_0_30px_rgba(245,158,11,0.2)]' 
            : 'border-dashed border-border-subtle hover:border-accent-primary bg-bg-surface shadow-sm'
        }`}
      >
        <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
        
        {files.length === 0 ? (
          <>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors duration-300 ${isDragging ? 'bg-accent-primary text-bg-base shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-bg-elevated text-text-secondary'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className={`font-semibold text-sm transition-colors duration-300 ${isDragging ? 'text-accent-primary' : 'text-text-primary'}`}>
              {isDragging ? t('dashboard.orDropFilesHere') : t('dashboard.addFiles')}
            </p>
            <p className="text-xs text-text-secondary mt-1">Direct peer transfer link</p>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <svg className={`w-5 h-5 transition-colors duration-300 ${isDragging ? 'text-accent-primary' : 'text-text-secondary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <p className={`font-semibold text-sm transition-colors duration-300 ${isDragging ? 'text-accent-primary' : 'text-text-primary'}`}>
              {isDragging ? t('dashboard.orDropFilesHere') : t('dashboard.addFiles')}
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{t('dashboard.codeValidity')}:</span>
              <div className="flex rounded border border-border-subtle overflow-hidden text-xs font-medium">
                {[2, 5, 30].map(m => (
                  <button
                    key={m}
                    onClick={() => setValidity(m)}
                    className={`px-3 py-1.5 ${validity === m ? 'bg-accent-primary text-bg-base' : 'bg-bg-surface text-text-secondary hover:text-text-primary'}`}
                  >
                    {m}min
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-right text-text-secondary font-medium">
              Total Files: {files.length}, {formatBytes(totalFileSize)}
            </div>
          </div>

          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded border border-border-subtle bg-bg-surface text-sm">
                <div className="flex items-center gap-2 truncate">
                  <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate text-text-primary">{file.name}</span>
                  <span className="text-xs text-text-secondary whitespace-nowrap ml-2">{formatBytes(file.size)}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="text-status-error hover:text-status-error/80 px-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>

          {receivers.length > 0 && (
            <div className="pt-4 border-t border-border-subtle space-y-3">
              {receivers.map((r) => (
                <div key={r.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-text-primary">
                      <span className="w-2 h-2 rounded-full bg-text-primary"></span>
                      <span className="font-semibold">{r.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{r.progress}%</span>
                      <svg className="w-3 h-3 text-status-error cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                  </div>
                  {r.status === 'sending' && (
                    <div className="w-full h-1 bg-bg-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-accent-primary" style={{ width: `${r.progress}%` }}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Receiver Code Input - Always Visible */}
      <form onSubmit={handleAddReceiver} className="flex flex-col w-full mt-auto">
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
        {lockoutSeconds > 0 && <LockoutBanner remainingSeconds={lockoutSeconds} message="Too many attempts." />}
      </form>
    </div>
  );
}
