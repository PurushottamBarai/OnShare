import React, { useState, useEffect, useRef } from 'react';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { ReceiverSink } from '../transfer/receiverSink.js';
import { TextSession, MAX_TEXT_CHARACTERS } from '../text/TextSession.js';
import DeviceLabelChip from '../components/DeviceLabelChip.jsx';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'msi', 'js', 'vbs', 'ps1', 'apk', 'app', 'bin', 'com', 'scr',
]);

export default function Receive() {
  const [code, setCode] = useState(null);
  const [countdown, setCountdown] = useState(600); // 10 minutes default
  const [receiverState, setReceiverState] = useState('CONNECTING'); // 'CONNECTING' | 'WAITING' | 'MATCHED' | 'AWAITING_ACCEPT' | 'TRANSFERRING' | 'TEXT_ACTIVE' | 'DONE' | 'DECLINED' | 'EXPIRED' | 'FAILED' | 'CANCELLED'
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [manifest, setManifest] = useState(null);

  // Transfer state
  const [transferProgress, setTransferProgress] = useState({
    percent: 0,
    bytesReceived: 0,
    totalSize: 0,
    speedBps: 0,
    timeRemainingSec: 0,
  });
  const [receivedFileResult, setReceivedFileResult] = useState(null);

  // Live text state
  const [liveText, setLiveText] = useState('');
  const [canEditText, setCanEditText] = useState(false);
  const [textCopied, setTextCopied] = useState(false);

  const signalingRef = useRef(null);
  const peerManagerRef = useRef(null);
  const receiverSinkRef = useRef(null);
  const textSessionRef = useRef(null);

  // Initialize and connect receiver socket on mount (RC-1)
  const initReceiver = () => {
    cleanup();
    setReceiverState('CONNECTING');
    setErrorMessage(null);
    setManifest(null);
    setReceivedFileResult(null);
    setTransferProgress({
      percent: 0,
      bytesReceived: 0,
      totalSize: 0,
      speedBps: 0,
      timeRemainingSec: 0,
    });
    setLiveText('');
    setCanEditText(false);

    const client = new SignalingClient();
    signalingRef.current = client;

    client.on('receiver.created', (payload) => {
      setCode(payload.code);
      setReceiverState('WAITING');
      const remaining = Math.max(0, Math.floor((payload.expiresAt - Date.now()) / 1000));
      setCountdown(remaining || 600);
    });

    client.on('receiver.matched', (payload) => {
      setReceiverState('MATCHED');

      // Create PeerManager for receiver
      peerManagerRef.current = new PeerManager({
        peerId: 'sender',
        role: 'receiver',
        iceServers: payload.iceServers,
        signalingClient: client,
        onManifest: (manifestData) => {
          setManifest(manifestData);
          setReceiverState('AWAITING_ACCEPT');
        },
        onControlMessage: (ctrlMsg) => {
          if (textSessionRef.current) {
            textSessionRef.current.handleControlMessage(ctrlMsg);
          }
        },
        onStateChange: (state) => {
          if (state === 'DECLINED') setReceiverState('DECLINED');
          if (state === 'FAILED') {
            setReceiverState('FAILED');
            setErrorMessage('Peer connection failed.');
          }
        },
      });
      peerManagerRef.current.init();
    });

    client.on('signal', (msg) => {
      peerManagerRef.current?.handleSignal(msg);
    });

    client.on('session.closed', (payload) => {
      if (receiverState !== 'DONE' && receiverState !== 'DECLINED' && receiverState !== 'TEXT_ACTIVE') {
        setReceiverState('FAILED');
        setErrorMessage(payload.reason === 'sender_ended' ? 'Sender ended the session.' : 'Sender disconnected.');
      }
    });

    client.on('error', (payload) => {
      if (payload.code === 'OTP_EXPIRED') {
        setReceiverState('EXPIRED');
        setErrorMessage('Code has expired after 10 minutes.');
      } else {
        setReceiverState('FAILED');
        setErrorMessage(payload.message || 'An error occurred.');
      }
    });

    client.connectReceiver();
  };

  const cleanup = () => {
    receiverSinkRef.current?.cancel();
    receiverSinkRef.current = null;
    textSessionRef.current?.destroy();
    textSessionRef.current = null;
    peerManagerRef.current?.close();
    peerManagerRef.current = null;
    signalingRef.current?.close();
    signalingRef.current = null;
  };

  useEffect(() => {
    initReceiver();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (receiverState !== 'WAITING' || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setReceiverState('EXPIRED');
          setErrorMessage('Code has expired after 10 minutes.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [receiverState, countdown]);

  // Tab Title status update (RC-9)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (code && receiverState === 'WAITING') {
      document.title = `[${code.slice(0, 3)} ${code.slice(3)}] Waiting for sender — SharePort`;
    } else if (receiverState === 'AWAITING_ACCEPT') {
      document.title = `[Accept?] Incoming Transfer — SharePort`;
    } else if (receiverState === 'TRANSFERRING') {
      document.title = `[${transferProgress.percent}%] Receiving Files — SharePort`;
    } else if (receiverState === 'TEXT_ACTIVE') {
      document.title = `[Live Text] Connected — SharePort`;
    } else if (receiverState === 'DONE') {
      document.title = `[Complete] Files Received — SharePort`;
    } else {
      document.title = `SharePort - Receive`;
    }
    return () => {
      document.title = 'SharePort - Direct Browser File & Live Text Sharing';
    };
  }, [code, receiverState, transferProgress.percent]);

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleRegenerate = () => {
    signalingRef.current?.regenerateCode();
    initReceiver();
  };

  const handleAccept = async () => {
    if (!peerManagerRef.current || receiverSinkRef.current || textSessionRef.current) return;

    if (manifest?.mode === 'text') {
      // Initialize live text session
      const textSession = new TextSession({
        role: 'receiver',
        onTextChange: (text) => setLiveText(text),
        onPermissionChange: (allowed) => setCanEditText(allowed),
      });
      textSessionRef.current = textSession;

      textSession.addPeer('sender', peerManagerRef.current.textChannel, peerManagerRef.current.controlChannel);
      peerManagerRef.current.acceptTransfer();
      setReceiverState('TEXT_ACTIVE');
      return;
    }

    // File transfer path
    const sink = new ReceiverSink({
      manifest,
      controlChannel: peerManagerRef.current.controlChannel,
      dataChannel: peerManagerRef.current.dataChannel,
      onProgress: (p) => setTransferProgress(p),
      onComplete: (res) => {
        setReceivedFileResult(res);
        setReceiverState('DONE');
      },
      onError: (err) => {
        setReceiverState('FAILED');
        setErrorMessage(err.message || 'File transfer failed');
      },
    });
    receiverSinkRef.current = sink;

    // Optional direct file system stream on Chromium
    await sink.initFileSystemTarget();

    peerManagerRef.current.acceptTransfer();
    setReceiverState('TRANSFERRING');
  };

  const handleDecline = () => {
    peerManagerRef.current?.declineTransfer();
    setReceiverState('DECLINED');
  };

  const handleCancelTransfer = () => {
    receiverSinkRef.current?.cancel();
    peerManagerRef.current?.close();
    setReceiverState('CANCELLED');
    setErrorMessage('Transfer cancelled by user.');
  };

  // Text tools
  const handleCopyText = async () => {
    if (!liveText) return;
    try {
      await navigator.clipboard.writeText(liveText);
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadText = () => {
    const blob = new Blob([liveText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SharePort-Text-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const hasExecutableFiles = manifest?.files?.some(f => {
    const ext = (f.name || '').split('.').pop()?.toLowerCase();
    return EXECUTABLE_EXTENSIONS.has(ext);
  });

  return (
    <div data-testid="route-receive" className="w-full max-w-content mx-auto py-8 px-4 flex flex-col items-center">
      {/* 1. Waiting for Sender State (RC-1, RC-2, RC-3, RC-4) */}
      {(receiverState === 'CONNECTING' || receiverState === 'WAITING' || receiverState === 'MATCHED') && (
        <div className="w-full max-w-lg p-8 rounded-card bg-bg-surface border border-border-subtle shadow-sm text-center mx-auto flex flex-col justify-center min-h-[300px]">
          <span className="text-xs uppercase tracking-wider font-semibold text-accent-primary">
            Receiver Code
          </span>

          <div className="my-6">
            <div
              data-testid="receive-code-display"
              className="text-5xl font-mono font-bold tracking-widest text-accent-primary select-all"
            >
              {code ? `${code.slice(0, 3)} ${code.slice(3)}` : '------'}
            </div>

            {/* Copy Button */}
            {code && (
              <button
                onClick={handleCopyCode}
                data-testid="copy-code-btn"
                className="mt-3 px-4 py-1.5 rounded-pill text-xs font-semibold bg-bg-base border border-border-subtle hover:border-accent-primary text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Status & Expiry countdown */}
          <div className="flex items-center justify-between text-helper text-text-secondary mb-6 px-2">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-warning animate-ping" />
              {receiverState === 'MATCHED' ? 'Connecting to sender...' : 'Waiting for sender…'}
            </span>
            <span data-testid="expiry-countdown" className="font-mono font-medium">
              Expires in {formatTime(countdown)}
            </span>
          </div>

          <p className="text-xs text-text-secondary mb-6">
            Share this 6-digit code with the sender. They will enter it to start the direct transfer.
          </p>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleRegenerate}
              data-testid="regenerate-code-btn"
              className="px-4 py-2 text-sm font-medium rounded-button bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary cursor-pointer"
            >
              Regenerate Code
            </button>
          </div>
        </div>
      )}

      {/* 2. Accept / Decline — compact inline card (RC-5, FL-8) */}
      {receiverState === 'AWAITING_ACCEPT' && manifest && (
        <div
          data-testid="accept-decline-modal"
          className="w-full max-w-md p-4 rounded-card bg-bg-surface border border-border-subtle shadow-sm"
        >
          <div className="flex items-start gap-3 mb-3">
            <DeviceLabelChip name={manifest.senderLabel || 'Unknown Peer'} />
            <div className="flex-1 min-w-0 text-left">
              {manifest.mode === 'text' ? (
                <p className="text-sm text-text-primary font-medium">Live Text Session</p>
              ) : (
                <>
                  <p className="text-sm text-text-primary font-medium" data-testid="manifest-file-count">
                    {manifest.files?.length || 0} file{(manifest.files?.length || 0) !== 1 ? 's' : ''} · <span data-testid="manifest-total-size">{formatBytes(manifest.totalSize)}</span>
                  </p>
                  {manifest.files && manifest.files.length <= 3 && manifest.files.map((file, idx) => (
                    <p key={idx} className="text-xs text-text-secondary truncate">{file.name}</p>
                  ))}
                  {manifest.files && manifest.files.length > 3 && (
                    <p className="text-xs text-text-secondary">{manifest.files[0].name} and {manifest.files.length - 1} more…</p>
                  )}
                </>
              )}
            </div>
          </div>

          {hasExecutableFiles && (
            <div data-testid="executable-warning" className="mb-3 p-2 rounded bg-status-warning/15 border border-status-warning text-xs text-status-warning flex items-center gap-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Contains executable files — only accept if you trust the sender.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleDecline}
              data-testid="decline-btn"
              className="flex-1 py-2 px-3 rounded-button text-sm font-medium bg-bg-elevated border border-border-subtle hover:border-status-error text-status-error cursor-pointer"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              data-testid="accept-btn"
              className="flex-1 py-2 px-3 rounded-button text-sm font-medium bg-accent-primary hover:bg-accent-hover text-bg-base cursor-pointer"
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {/* 3. Live File Transferring Progress State (RC-6, RC-7) */}
      {receiverState === 'TRANSFERRING' && (
        <div data-testid="receive-transferring-screen" className="w-full max-w-lg p-6 sm:p-8 rounded-card bg-bg-surface border border-border-subtle shadow-lg space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-h2 text-text-primary">Receiving Content</h2>
              <p className="text-xs text-text-secondary">
                {manifest?.files?.length > 1 ? 'Streaming packaged ZIP archive…' : 'Streaming file direct to browser…'}
              </p>
            </div>
            {manifest?.files?.length > 1 && (
              <span data-testid="preparing-zip-badge" className="text-xs font-semibold px-2.5 py-1 rounded bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                Streaming ZIP
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-accent-primary">{transferProgress.percent}%</span>
              <span className="text-text-secondary font-mono">
                {formatBytes(transferProgress.bytesReceived)} / {formatBytes(transferProgress.totalSize || manifest?.totalSize)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-bg-elevated overflow-hidden border border-border-subtle">
              <div
                data-testid="receive-progress-bar"
                className="h-full bg-accent-primary transition-all duration-150 ease-out"
                style={{ width: `${Math.min(100, transferProgress.percent)}%` }}
              />
            </div>
          </div>

          {/* Speed & Time stats */}
          <div className="flex justify-between text-xs text-text-secondary border-t border-border-subtle pt-3">
            <span>Speed: <strong className="text-text-primary">{formatBytes(transferProgress.speedBps)}/s</strong></span>
            <span>Estimated time: <strong className="text-text-primary">{transferProgress.timeRemainingSec}s left</strong></span>
          </div>

          {/* Cancel button (RC-7) */}
          <div className="text-center pt-2">
            <button
              onClick={handleCancelTransfer}
              data-testid="cancel-transfer-btn"
              className="text-xs text-status-error hover:underline cursor-pointer"
            >
              Cancel Transfer
            </button>
          </div>
        </div>
      )}

      {/* 4. Live Text Active State (TX-1 to TX-8) */}
      {receiverState === 'TEXT_ACTIVE' && (
        <div data-testid="receive-text-screen" className="w-full max-w-content p-6 rounded-card bg-bg-surface border border-border-subtle shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-h2 text-text-primary">Live Text Session</h2>
              <span
                data-testid={canEditText ? 'editable-badge' : 'readonly-badge'}
                className={`text-xs px-2.5 py-0.5 rounded-pill font-semibold ${canEditText ? 'bg-status-success/20 text-status-success' : 'bg-bg-elevated text-text-secondary'}`}
              >
                {canEditText ? 'Editing Enabled' : 'Read-Only'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                data-testid="receiver-copy-text-btn"
                className="px-3 py-1.5 text-xs font-semibold rounded-button bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-secondary hover:text-text-primary cursor-pointer"
              >
                {textCopied ? 'Copied!' : 'Copy All'}
              </button>
              <button
                onClick={handleDownloadText}
                data-testid="receiver-download-text-btn"
                className="px-3 py-1.5 text-xs font-semibold rounded-button bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-secondary hover:text-text-primary cursor-pointer"
              >
                Download .txt
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={liveText}
              disabled={!canEditText}
              onChange={(e) => {
                if (canEditText && textSessionRef.current) {
                  textSessionRef.current.replaceText(e.target.value);
                  setLiveText(e.target.value);
                }
              }}
              data-testid="receiver-text-editor"
              rows={12}
              placeholder={canEditText ? 'Type or edit shared text…' : 'Waiting for sender to type or allow editing…'}
              className="w-full p-4 rounded-button bg-bg-elevated border border-border-subtle focus:border-accent-primary text-text-primary font-mono text-sm leading-relaxed resize-y focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>{canEditText ? 'You can edit this text' : 'Read-only mode (sender controls permissions)'}</span>
              <span data-testid="receiver-char-counter">{liveText.length} / {MAX_TEXT_CHARACTERS}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Transfer Completed State (ST-3) */}
      {receiverState === 'DONE' && (
        <div data-testid="receive-accepted-screen" className="w-full max-w-md p-8 rounded-card bg-bg-surface border border-status-success text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-status-success/20 text-status-success flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-h2 text-text-primary">Transfer Complete</h2>
          <p className="text-helper text-text-secondary">
            {receivedFileResult?.filename ? `Received ${receivedFileResult.filename} (${formatBytes(receivedFileResult.totalBytes)})` : 'All content has been received successfully.'}
          </p>
          <div className="pt-2">
            <button
              onClick={initReceiver}
              data-testid="receive-again-btn"
              className="px-6 py-2.5 rounded-button font-semibold bg-accent-primary hover:bg-accent-hover text-bg-base cursor-pointer shadow-sm"
            >
              Receive Another File
            </button>
          </div>
        </div>
      )}

      {/* 6. Declined State */}
      {receiverState === 'DECLINED' && (
        <div data-testid="receive-declined-screen" className="w-full max-w-md p-8 rounded-card bg-bg-surface border border-status-error text-center">
          <h2 className="text-h2 text-text-primary mb-2">Transfer Declined</h2>
          <p className="text-helper text-text-secondary mb-6">
            You declined the incoming transfer from the sender.
          </p>
          <button
            onClick={initReceiver}
            data-testid="try-again-btn"
            className="px-6 py-2.5 rounded-button font-semibold bg-accent-primary text-bg-base cursor-pointer"
          >
            Generate New Code
          </button>
        </div>
      )}

      {/* 7. Error & Expiry States (RC-8) */}
      {(receiverState === 'EXPIRED' || receiverState === 'FAILED' || receiverState === 'CANCELLED') && (
        <div data-testid="receive-error-screen" className="w-full max-w-md p-8 rounded-card bg-bg-surface border border-border-subtle text-center">
          <div className="w-12 h-12 rounded-full bg-status-error/20 text-status-error flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-h2 text-text-primary mb-2">
            {receiverState === 'EXPIRED' ? 'Code Expired' : receiverState === 'CANCELLED' ? 'Transfer Cancelled' : 'Connection Error'}
          </h2>
          <p className="text-helper text-text-secondary mb-6">
            {errorMessage || 'Transfer was cancelled or closed.'}
          </p>
          <button
            onClick={initReceiver}
            data-testid={receiverState === 'EXPIRED' ? 'regenerate-code-btn' : 'try-again-btn'}
            className="px-6 py-2.5 rounded-button font-semibold bg-accent-primary hover:bg-accent-hover text-bg-base cursor-pointer"
          >
            {receiverState === 'EXPIRED' ? 'Regenerate Code' : 'Try Again'}
          </button>
        </div>
      )}
    </div>
  );
}
