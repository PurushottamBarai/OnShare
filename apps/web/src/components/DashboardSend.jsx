import React, { useState, useEffect, useRef } from 'react';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { generateDeviceLabel } from '../utils/deviceLabel.js';
import { SenderPipeline, generateZipFilename } from '../transfer/senderPipeline.js';
import LockoutBanner from './LockoutBanner.jsx';
import { useTranslation } from 'react-i18next';
import { setTransferStatus } from '../utils/transferState.js';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const MAX_SINGLE_FILE_BYTES = 35 * 1024 * 1024 * 1024; // 35 GB
export const MAX_ZIP_TOTAL_BYTES = 4 * 1024 * 1024 * 1024;     // 4 GB

export default function DashboardSend() {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [validity, setValidity] = useState(30);
  const [, setSessionActive] = useState(false);
  const [, setSessionId] = useState(null);
  const [codeEntry, setCodeEntry] = useState('');
  const [receivers, setReceivers] = useState([]);
  const [codeError, setCodeError] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [deviceLabel] = useState(() => generateDeviceLabel().fullLabel);
  const [isDragging, setIsDragging] = useState(false);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [broadcastCode, setBroadcastCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

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

    client.on('session.broadcastCreated', (payload) => {
      setBroadcastCode(payload.code);
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
                  setReceivers(curr => curr.map(item => item.id === receiverId ? {
                    ...item,
                    status: 'sending',
                    progress: p.percent,
                    speedBps: p.speedBps || 0,
                    bytesSent: p.bytesSent || 0,
                    totalSize: p.totalSize || item.totalSize || 0,
                  } : item));
                  setTransferStatus({ isActive: true, role: 'sender', progress: p.percent });
                },
                onComplete: () => {
                  setReceivers(curr => curr.map(item => item.id === receiverId ? {
                    ...item,
                    status: 'done',
                    progress: 100,
                    speedBps: 0,
                    bytesSent: item.totalSize || 0,
                  } : item));
                  setTransferStatus({ isActive: false, role: 'sender', progress: 100 });
                },
                onError: () => {
                  setReceivers(curr => curr.map(item => item.id === receiverId ? { ...item, status: 'failed' } : item));
                  setTransferStatus({ isActive: false, role: 'sender' });
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

  const validateAndAddFiles = (newFiles) => {
    if (!newFiles || newFiles.length === 0) return;
    setFileError(null);

    // 1. Check if any individual file exceeds 35GB
    const oversizedFile = newFiles.find(f => (f.size || 0) > MAX_SINGLE_FILE_BYTES);
    if (oversizedFile) {
      setFileError(t('dashboard.fileCapacityExceeded', 'File capacity exceeded, Max Capacity 35GB'));
      return;
    }

    const candidateFiles = [...files, ...newFiles];
    const totalBytes = candidateFiles.reduce((acc, f) => acc + (f.size || 0), 0);

    // 2. Check if total combined exceeds 35GB
    if (totalBytes > MAX_SINGLE_FILE_BYTES) {
      setFileError(t('dashboard.fileCapacityExceeded', 'File capacity exceeded, Max Capacity 35GB'));
      return;
    }

    // 3. Check if multiple files exceed 4GB (ZIP format limit)
    if (candidateFiles.length > 1 && totalBytes > MAX_ZIP_TOTAL_BYTES) {
      setFileError(
        t(
          'dashboard.zipCapacityExceeded',
          'Multiple files are zipped (Max 4GB). Please send files larger than 4GB individually (up to 35GB).'
        )
      );
      return;
    }

    setFiles(candidateFiles);
    if (isBroadcast && broadcastCode) {
      signalingRef.current?.invalidateBroadcast();
      setBroadcastCode(null);
    }
    ensureSession();
  };

  const handleFileSelect = (event) => {
    const selected = Array.from(event.target.files || []);
    validateAndAddFiles(selected);
    if (event.target) event.target.value = '';
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
    validateAndAddFiles(dropped);
  };

  const removeFile = (index) => {
    setFileError(null);
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (isBroadcast && broadcastCode) {
      signalingRef.current?.invalidateBroadcast();
      setBroadcastCode(null);
    }
  };

  const removeReceiver = (receiverId) => {
    const pipeline = senderPipelinesRef.current.get(receiverId);
    if (pipeline) {
      try {
        pipeline.cancel();
      } catch {
        // ignore
      }
      senderPipelinesRef.current.delete(receiverId);
    }

    const pm = peerManagersRef.current.get(receiverId);
    if (pm) {
      try {
        pm.close();
      } catch {
        // ignore
      }
      peerManagersRef.current.delete(receiverId);
    }

    setReceivers(prev => prev.filter(r => r.id !== receiverId));
  };

  const handleAddReceiver = (e) => {
    e.preventDefault();
    if (!codeEntry || codeEntry.length !== 6 || lockoutSeconds > 0) return;
    setCodeError(null);
    ensureSession();
    signalingRef.current?.addReceiver(codeEntry);
  };

  const handleStartBroadcast = () => {
    if (files.length === 0) {
      setFileError(t('dashboard.selectFilesFirst', 'Please select at least one file to send'));
      return;
    }
    setFileError(null);
    ensureSession();
    signalingRef.current?.createBroadcastCode();
  };

  const handleRegenerateBroadcast = () => {
    ensureSession();
    signalingRef.current?.regenerateBroadcast();
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

        {/* Broadcast Mode Toggle positioned between Send and Max 35GB */}
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

        <span className="text-xs text-text-secondary font-medium">Max 35GB</span>
      </div>

      {fileError && (
        <div className="flex items-center justify-between p-3 bg-status-error/10 border border-status-error/30 rounded-xl text-status-error text-xs relative z-20">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{fileError}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFileError(null)}
            className="text-text-secondary hover:text-text-primary ml-2 font-bold text-sm leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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
            <div className="text-xs text-right text-text-secondary font-medium flex items-center justify-end gap-2">
              <span>Total Files: {files.length}</span>
              <span className="opacity-40">•</span>
              <span>{formatBytes(totalFileSize)}</span>
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{r.progress}%</span>
                      <button
                        type="button"
                        onClick={() => removeReceiver(r.id)}
                        className="p-1 -mr-1 rounded hover:bg-bg-elevated text-status-error/80 hover:text-status-error transition-colors cursor-pointer"
                        title="Remove receiver"
                        aria-label="Remove receiver"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {r.status === 'sending' && (
                    <div className="space-y-1.5 mt-1">
                      <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-primary transition-all duration-150"
                          style={{ width: `${r.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-text-secondary">
                        <span>{formatBytes(r.speedBps)}/s</span>
                        <span>
                          {formatBytes(r.bytesSent)} / {formatBytes(r.totalSize)}
                        </span>
                      </div>
                    </div>
                  )}
                  {r.status === 'done' && (
                    <div className="flex justify-between text-xs text-status-success font-medium mt-0.5">
                      <span>Completed</span>
                      <span>{formatBytes(r.totalSize || r.bytesSent)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Receiver Code Input / Broadcast Action Section */}
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
            {lockoutSeconds > 0 && <LockoutBanner remainingSeconds={lockoutSeconds} message="Too many attempts." />}
          </form>
        )}
      </div>
    </div>
  );
}
