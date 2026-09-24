/**
 * PeerManager (TRD Section 7.1, 7.2, 9)
 * Manages RTCPeerConnection and the "control" DataChannel for manifest handshake
 */
export class PeerManager {
  constructor({ peerId, role, iceServers, signalingClient, onManifest, onStateChange }) {
    this.peerId = peerId; // receiverId or 'sender'
    this.role = role; // 'sender' | 'receiver'
    this.iceServers = iceServers || [{ urls: 'stun:stun.l.google.com:19302' }];
    this.signalingClient = signalingClient;
    this.onManifest = onManifest;
    this.onStateChange = onStateChange;

    this.pc = null;
    this.controlChannel = null;
    this.state = 'CONNECTING'; // 'CONNECTING' | 'WAITING_ACCEPT' | 'ACCEPTED' | 'DECLINED' | 'FAILED' | 'CLOSED'
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
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
        this.setState('FAILED');
      }
    };

    if (this.role === 'sender') {
      // Sender creates control channel
      this.controlChannel = this.pc.createDataChannel('control', { ordered: true });
      this.setupControlChannel(this.controlChannel, manifestToSend);

      // Create and send offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.signalingClient.sendSignal('signal.offer', this.peerId, offer);
    } else {
      // Receiver listens for incoming control data channel
      this.pc.ondatachannel = (event) => {
        if (event.channel.label === 'control') {
          this.controlChannel = event.channel;
          this.setupControlChannel(this.controlChannel, null);
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
        if (data.type === 'manifest') {
          this.setState('WAITING_ACCEPT', data);
          if (this.onManifest) {
            this.onManifest(data);
          }
        } else if (data.type === 'accept') {
          this.setState('ACCEPTED');
        } else if (data.type === 'decline') {
          this.setState('DECLINED');
        }
      } catch (err) {
        console.error('[PeerManager] Error parsing control channel message:', err);
      }
    };

    channel.onclose = () => {
      if (this.state !== 'DECLINED' && this.state !== 'ACCEPTED') {
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
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.signalingClient.sendSignal('signal.answer', 'sender', answer);
      } else if (signal.type === 'signal.answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (signal.type === 'signal.ice') {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(data));
        } catch {
          // ignore candidate race
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
    if (this.controlChannel) {
      try { this.controlChannel.close(); } catch { /* ignore */ }
      this.controlChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch { /* ignore */ }
      this.pc = null;
    }
    this.setState('CLOSED');
  }
}
