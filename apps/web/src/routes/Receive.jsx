import React, { useState, useEffect, useRef } from 'react';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import DeviceLabelChip from '../components/DeviceLabelChip.jsx';
import AdSlot from '../components/AdSlot.jsx';

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

export default function Receive() {
  const [code, setCode] = useState(null);
  const [countdown, setCountdown] = useState(600); // 10 minutes default
  const [receiverState, setReceiverState] = useState('CONNECTING'); // 'CONNECTING' | 'WAITING' | 'MATCHED' | 'AWAITING_ACCEPT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'FAILED' | 'CANCELLED'
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [manifest, setManifest] = useState(null);

  const signalingRef = useRef(null);
  const peerManagerRef = useRef(null);

  // Initialize and connect receiver socket on mount (RC-1)
  const initReceiver = () => {
    cleanup();
    setReceiverState('CONNECTING');
    setErrorMessage(null);
    setManifest(null);

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
        onStateChange: (state) => {
          if (state === 'ACCEPTED') setReceiverState('ACCEPTED');
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
      if (receiverState !== 'ACCEPTED' && receiverState !== 'DECLINED') {
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
    } else if (receiverState === 'ACCEPTED') {
      document.title = `[Accepted] Connected — SharePort`;
    } else {
      document.title = `SharePort - Receive`;
    }
    return () => {
      document.title = 'SharePort - Direct Browser File & Live Text Sharing';
    };
  }, [code, receiverState]);

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

  const handleCancel = () => {
    cleanup();
    setReceiverState('CANCELLED');
  };

  const handleAccept = () => {
    peerManagerRef.current?.acceptTransfer();
    setReceiverState('ACCEPTED');
  };

  const handleDecline = () => {
    peerManagerRef.current?.declineTransfer();
    setReceiverState('DECLINED');
  };

  return (
    <div data-testid="route-receive" className="w-full max-w-content mx-auto py-8 px-4 flex flex-col items-center">
      {/* 1. Normal Waiting for Sender State (RC-1, RC-2, RC-3, RC-4) */}
      {(receiverState === 'CONNECTING' || receiverState === 'WAITING' || receiverState === 'MATCHED') && (
        <div className="w-full max-w-md p-8 rounded-card bg-bg-surface border border-border-subtle text-center shadow-lg">
          <span className="text-xs uppercase tracking-wider font-semibold text-accent-primary">
            Receiver Access Code
          </span>
          <h1 className="text-h2 text-text-primary mt-1 mb-6">Receive Content</h1>

          {/* 6-Digit Code Display (UI brief 3.3: 48-64px tabular bold) */}
          <div className="my-6 p-4 rounded-card bg-bg-elevated border border-border-subtle flex flex-col items-center justify-center">
            {code ? (
              <div
                data-testid="receive-code-display"
                className="text-code-lg font-mono font-bold tracking-widest text-accent-primary select-all"
              >
                {code.slice(0, 3)} {code.slice(3)}
              </div>
            ) : (
              <div className="text-code-lg font-mono font-bold text-text-secondary animate-pulse">
                ••••••
              </div>
            )}

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

          {/* Status & Expiry countdown ring/timer */}
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
            Share this 6-digit code with the person sending files or text.
            They will type it in to connect.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleRegenerate}
              data-testid="regenerate-code-btn"
              className="px-4 py-2 text-sm font-medium rounded-button bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary cursor-pointer"
            >
              Regenerate Code
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium rounded-button text-text-secondary hover:text-status-error cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 2. Accept / Decline Handshake Prompt (RC-5) */}
      {receiverState === 'AWAITING_ACCEPT' && manifest && (
        <div
          data-testid="accept-decline-modal"
          className="w-full max-w-lg p-6 sm:p-8 rounded-card bg-bg-surface border-2 border-accent-primary shadow-2xl text-center"
        >
          <div className="w-12 h-12 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>

          <h2 className="text-h2 text-text-primary mb-1">Incoming Transfer Request</h2>
          <p className="text-helper text-text-secondary mb-4">
            A sender connected with your code and wants to send you content.
          </p>

          {/* Sender Device Label (SN-10, RC-5) */}
          <div className="my-4">
            <DeviceLabelChip name={manifest.senderLabel || 'Unknown Peer'} />
          </div>

          {/* Manifest summary */}
          <div className="my-6 p-4 rounded-button bg-bg-elevated border border-border-subtle text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Total Files:</span>
              <span className="font-semibold text-text-primary" data-testid="manifest-file-count">
                {manifest.files?.length || 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Total Size:</span>
              <span className="font-semibold text-text-primary" data-testid="manifest-total-size">
                {formatBytes(manifest.totalSize)}
              </span>
            </div>

            {/* File List */}
            {manifest.files && manifest.files.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border-subtle max-h-36 overflow-y-auto space-y-1">
                {manifest.files.map((file, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-text-secondary py-0.5">
                    <span className="truncate pr-2">{file.name}</span>
                    <span className="font-mono flex-shrink-0">{formatBytes(file.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accept / Decline Action Buttons (RC-5) */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={handleDecline}
              data-testid="decline-btn"
              className="flex-1 py-3 px-4 rounded-button font-semibold bg-bg-elevated border border-border-subtle hover:border-status-error text-status-error cursor-pointer"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              data-testid="accept-btn"
              className="flex-1 py-3 px-4 rounded-button font-semibold bg-accent-primary hover:bg-accent-hover text-bg-base cursor-pointer shadow-md"
            >
              Accept Transfer
            </button>
          </div>
        </div>
      )}

      {/* 3. Accepted Handshake State */}
      {receiverState === 'ACCEPTED' && (
        <div data-testid="receive-accepted-screen" className="w-full max-w-md p-8 rounded-card bg-bg-surface border border-status-success text-center">
          <div className="w-12 h-12 rounded-full bg-status-success/20 text-status-success flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-h2 text-text-primary mb-2">Transfer Accepted</h2>
          <p className="text-helper text-text-secondary mb-6">
            Handshake completed! WebRTC DataChannel connection is active.
          </p>
          <button
            onClick={initReceiver}
            className="px-6 py-2.5 rounded-button font-semibold bg-accent-primary text-bg-base cursor-pointer"
          >
            Receive Another File
          </button>
        </div>
      )}

      {/* 4. Declined State */}
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

      {/* 5. Error & Expiry States (RC-8) */}
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

      <AdSlot height="100px" className="mt-10" />
    </div>
  );
}
