import React, { useState, useEffect, useRef } from 'react';
import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerManager } from '../webrtc/PeerManager.js';
import { ReceiverSink } from '../transfer/receiverSink.js';
import { TextSession } from '../text/TextSession.js';
import DeviceLabelChip from './DeviceLabelChip.jsx';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DashboardReceive({ onTextSessionActive }) {
  const [code, setCode] = useState(null);
  const [receiverState, setReceiverState] = useState('CONNECTING');
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [manifest, setManifest] = useState(null);

  const [transferProgress, setTransferProgress] = useState({ percent: 0, bytesReceived: 0, totalSize: 0, speedBps: 0, timeRemainingSec: 0 });
  const [receivedFileResult, setReceivedFileResult] = useState(null);

  const signalingRef = useRef(null);
  const peerManagerRef = useRef(null);
  const receiverSinkRef = useRef(null);

  const initReceiver = () => {
    cleanup();
    setReceiverState('CONNECTING');
    setErrorMessage(null);
    setManifest(null);
    setReceivedFileResult(null);
    setTransferProgress({ percent: 0, bytesReceived: 0, totalSize: 0, speedBps: 0, timeRemainingSec: 0 });

    const client = new SignalingClient();
    signalingRef.current = client;

    client.on('receiver.created', (payload) => {
      setCode(payload.code);
      setReceiverState('WAITING');
    });

    client.on('receiver.matched', (payload) => {
      setReceiverState('MATCHED');

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
          // If we need to pass this to the text session which is now handled by the dashboard text component?
          // Since the TextSession needs to be connected to this PeerManager's channels, 
          // we can just bubble this up via onTextSessionActive callback.
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
      setReceiverState('FAILED');
      setErrorMessage(payload.message || 'An error occurred.');
    });

    client.connectReceiver();
  };

  const cleanup = () => {
    receiverSinkRef.current?.cancel();
    receiverSinkRef.current = null;
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

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRegenerate = () => {
    signalingRef.current?.regenerateCode();
    initReceiver();
  };

  const handleAccept = async () => {
    if (!peerManagerRef.current || receiverSinkRef.current) return;

    if (manifest?.mode === 'text') {
      peerManagerRef.current.acceptTransfer();
      setReceiverState('TEXT_ACTIVE');
      if (onTextSessionActive) {
        onTextSessionActive(peerManagerRef.current);
      }
      return;
    }

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

    await sink.initFileSystemTarget();
    peerManagerRef.current.acceptTransfer();
    setReceiverState('TRANSFERRING');
  };

  const handleDecline = () => {
    peerManagerRef.current?.declineTransfer();
    setReceiverState('DECLINED');
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2 font-bold uppercase text-text-primary text-sm tracking-wide">
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Receive</span>
        </div>
        <span className="text-xs text-text-secondary font-medium">6-Digit Key</span>
      </div>

      <div className="w-full h-48 rounded-xl border border-border-subtle bg-bg-surface flex flex-col items-center justify-center shadow-sm">
        <div className="text-4xl font-mono font-bold tracking-[0.5em] text-text-primary mb-6 ml-4 select-all">
          {code ? `${code.slice(0, 3)} ${code.slice(3)}` : '------'}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleRegenerate}
            className="px-4 py-1.5 rounded text-sm font-medium bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary flex items-center gap-2 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Regenerate
          </button>
          <button
            onClick={handleCopyCode}
            className="px-4 py-1.5 rounded text-sm font-medium bg-bg-elevated border border-border-subtle hover:border-accent-primary text-text-primary flex items-center gap-2 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* States rendering */}
      <div className="flex-1">
        {receiverState === 'AWAITING_ACCEPT' && manifest && (
          <div className="w-full p-4 rounded-lg bg-bg-surface border border-border-subtle shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <DeviceLabelChip name={manifest.senderLabel || 'Unknown'} />
              <div className="flex-1 min-w-0 text-right">
                {manifest.mode === 'text' ? (
                  <p className="text-sm font-medium text-text-primary">Text Session</p>
                ) : (
                  <p className="text-sm font-medium text-text-primary">
                    {manifest.files?.length || 0} file{(manifest.files?.length || 0) !== 1 ? 's' : ''}, {formatBytes(manifest.totalSize)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDecline} className="flex-1 py-1.5 rounded text-sm font-medium bg-bg-elevated border border-border-subtle text-text-primary hover:text-status-error transition-colors cursor-pointer">
                Decline
              </button>
              <button onClick={handleAccept} className="flex-1 py-1.5 rounded text-sm font-medium bg-accent-primary text-bg-base hover:bg-accent-hover transition-colors cursor-pointer">
                Accept
              </button>
            </div>
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
            <button onClick={initReceiver} className="text-xs px-3 py-1 rounded bg-bg-surface border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer">
              Reset
            </button>
          </div>
        )}

        {(receiverState === 'FAILED' || receiverState === 'EXPIRED' || receiverState === 'DECLINED') && (
          <div className="w-full p-4 rounded-lg bg-status-error/10 border border-status-error shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-2 text-status-error">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="text-sm font-medium">{receiverState === 'DECLINED' ? 'Declined' : 'Failed'}</span>
             </div>
             <button onClick={initReceiver} className="text-xs px-3 py-1 rounded bg-bg-surface border border-border-subtle hover:border-accent-primary transition-colors cursor-pointer text-text-primary">
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
