/**
 * PeerManager (TRD Section 7.1, 7.2, 9)
 * Manages RTCPeerConnection and the "control", "data", and "text" DataChannels.
 */
export class PeerManager {
  constructor({
    peerId,
    role,
    iceServers,
    signalingClient,
    onManifest,
    onControlMessage,
    onStateChange,
    onChannelsReady,
  }) {
    this.peerId = peerId; // receiverId or 'sender'
    this.role = role; // 'sender' | 'receiver'
    this.signalingClient = signalingClient;
    this.iceServers = (iceServers && iceServers.length > 0) ? iceServers : [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
          'stun:openrelay.metered.ca:80',
        ],
      },
    ];
    this.onManifest = onManifest;
    this.onControlMessage = onControlMessage;
    this.onStateChange = onStateChange;
    this.onChannelsReady = onChannelsReady;

    this.pc = null;
    this.controlChannel = null;
    this.dataChannel = null;
    this.textChannel = null;
    this.state = 'CONNECTING'; // 'CONNECTING' | 'WAITING_ACCEPT' | 'ACCEPTED' | 'TRANSFERRING' | 'DONE' | 'DECLINED' | 'FAILED' | 'CLOSED'
    this.pendingCandidates = [];
    this.disconnectTimeout = null;

    if (typeof window !== 'undefined') {
      window.__activePeerManagers = window.__activePeerManagers || new Set();
      window.__activePeerManagers.add(this);
    }
  }

  setState(newState, details = null) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState, details);
    }
  }

  async init(manifestToSend = null) {
    if (typeof RTCPeerConnection === 'undefined') {
      this.setState('FAILED', 'WebRTC not supported in this environment');
      return;
    }

    this.pc = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingClient.sendSignal('signal.ice', this.peerId, event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed') {
        this.setState('FAILED');
      } else if (this.pc.connectionState === 'disconnected') {
        if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
        this.disconnectTimeout = setTimeout(() => {
          if (this.pc?.connectionState === 'disconnected') {
            this.setState('FAILED');
          }
        }, 5000);
      } else if (this.pc.connectionState === 'connected') {
        if (this.disconnectTimeout) {
          clearTimeout(this.disconnectTimeout);
          this.disconnectTimeout = null;
        }
      }
    };

    if (this.role === 'sender') {
      // Sender creates control, data, and text channels
      this.controlChannel = this.pc.createDataChannel('control', { ordered: true });
      this.dataChannel = this.pc.createDataChannel('data', { ordered: true });
      this.dataChannel.binaryType = 'arraybuffer';
      this.textChannel = this.pc.createDataChannel('text', { ordered: true });
      this.textChannel.binaryType = 'arraybuffer';

      this.setupControlChannel(this.controlChannel, manifestToSend);

      if (this.onChannelsReady) {
        this.onChannelsReady({
          controlChannel: this.controlChannel,
          dataChannel: this.dataChannel,
          textChannel: this.textChannel,
        });
      }

      // Create and send offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.signalingClient.sendSignal('signal.offer', this.peerId, offer);
    } else {
      // Receiver listens for incoming data channels
      this.pc.ondatachannel = (event) => {
        const { label } = event.channel;
        if (label === 'control') {
          this.controlChannel = event.channel;
          this.setupControlChannel(this.controlChannel, null);
        } else if (label === 'data') {
          this.dataChannel = event.channel;
          this.dataChannel.binaryType = 'arraybuffer';
        } else if (label === 'text') {
          this.textChannel = event.channel;
          this.textChannel.binaryType = 'arraybuffer';
        }

        if (this.controlChannel && (this.dataChannel || this.textChannel)) {
          if (this.onChannelsReady) {
            this.onChannelsReady({
              controlChannel: this.controlChannel,
              dataChannel: this.dataChannel,
              textChannel: this.textChannel,
            });
          }
        }
      };
    }
  }

  setupControlChannel(channel, manifestToSend) {
    const sendManifestIfReady = () => {
      if (this.role === 'sender' && manifestToSend && channel.readyState === 'open') {
        try {
          channel.send(JSON.stringify({
            type: 'manifest',
            ...manifestToSend,
          }));
          this.setState('WAITING_ACCEPT');
        } catch (e) {
          console.error('[PeerManager] Failed to send manifest on control channel:', e);
        }
      }
    };

    channel.onopen = () => {
      sendManifestIfReady();
    };

    if (channel.readyState === 'open') {
      sendManifestIfReady();
    }

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (this.onControlMessage) {
          this.onControlMessage(data);
        }

        if (data.type === 'manifest') {
          this.setState('WAITING_ACCEPT', data);
          if (this.onManifest) {
            this.onManifest(data);
          }
        } else if (data.type === 'accept') {
          this.setState('ACCEPTED');
        } else if (data.type === 'decline') {
          this.setState('DECLINED');
        } else if (data.type === 'cancel') {
          this.setState('FAILED', 'Transfer cancelled by peer');
        } else if (data.type === 'complete') {
          this.setState('DONE');
        }
      } catch (err) {
        console.error('[PeerManager] Error parsing control channel message:', err);
      }
    };

    channel.onclose = () => {
      if (this.state !== 'DECLINED' && this.state !== 'ACCEPTED' && this.state !== 'DONE') {
        this.setState('CLOSED');
      }
    };

    channel.onerror = (err) => {
      console.error('[PeerManager] Control channel error:', err);
      this.setState('FAILED');
    };
  }

  async handleSignal(signal) {
    if (!this.pc) return;

    try {
      const data = signal.payload?.payload !== undefined ? signal.payload.payload : signal.payload;
      if (!data) return;

      if (signal.type === 'signal.offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data));
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {
            // ignore
          }
        }
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.signalingClient.sendSignal('signal.answer', 'sender', answer);
      } else if (signal.type === 'signal.answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data));
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {
            // ignore
          }
        }
      } else if (signal.type === 'signal.ice') {
        if (!this.pc.remoteDescription) {
          this.pendingCandidates.push(data);
        } else {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(data));
          } catch {
            // ignore candidate race
          }
        }
      }
    } catch (err) {
      console.error('[PeerManager] handleSignal error:', signal.type, err);
    }
  }

  acceptTransfer() {
    if (this.controlChannel && this.controlChannel.readyState === 'open') {
      this.controlChannel.send(JSON.stringify({ type: 'accept' }));
      this.setState('ACCEPTED');
    }
  }

  declineTransfer() {
    if (this.controlChannel && this.controlChannel.readyState === 'open') {
      this.controlChannel.send(JSON.stringify({ type: 'decline' }));
      this.setState('DECLINED');
      this.close();
    }
  }

  close() {
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }
    if (typeof window !== 'undefined' && window.__activePeerManagers) {
      window.__activePeerManagers.delete(this);
    }
    if (this.controlChannel) {
      try { this.controlChannel.close(); } catch { /* ignore */ }
      this.controlChannel = null;
    }
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch { /* ignore */ }
      this.dataChannel = null;
    }
    if (this.textChannel) {
      try { this.textChannel.close(); } catch { /* ignore */ }
      this.textChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch { /* ignore */ }
      this.pc = null;
    }
    this.setState('CLOSED');
  }
}
