import { parseAndValidateMessage, serializeMessage } from '@shareport/protocol';

/**
 * SignalingClient (TRD Section 9 & 12)
 * WebSocket client with exponential backoff reconnect and Zod runtime schema validation.
 */
export class SignalingClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || this.getDefaultSignalingUrl();
    this.role = null; // 'sender' | 'receiver'
    this.socket = null;
    this.joinSocket = null; // For receiver after match
    this.listeners = new Map();

    // Session data
    this.sessionId = null;
    this.senderToken = null;
    this.iceServers = [];

    // Reconnection & heartbeat
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.heartbeatInterval = null;
    this.missedHeartbeats = 0;
    this.isManualClose = false;
    this.pendingMessages = [];
  }

  getDefaultSignalingUrl() {
    if (typeof window === 'undefined') return 'ws://127.0.0.1:8787/ws';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (import.meta.env?.VITE_SIGNALING_URL) {
      return import.meta.env.VITE_SIGNALING_URL;
    }
    // Connect directly to 127.0.0.1:8787 when in local dev (port 3000 or 5173)
    if (window.location.port === '3000' || window.location.port === '5173') {
      return `${proto}//127.0.0.1:8787/ws`;
    }
    const host = window.location.host;
    return `${proto}//${host}/ws`;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(data);
        } catch {
          // ignore
        }
      });
    }
  }

  /**
   * Connect as Receiver (HM-1, RC-1)
   */
  connectReceiver() {
    this.role = 'receiver';
    this.isManualClose = false;
    const url = `${this.baseUrl}/receiver`;
    this.openSocket(url);
  }

  /**
   * Connect as Sender (HM-1, SN-1)
   */
  connectSender(options = {}) {
    this.role = 'sender';
    this.isManualClose = false;
    const params = new URLSearchParams();
    if (options.validity) params.set('validity', String(options.validity));
    if (options.mode) params.set('mode', options.mode);
    if (this.sessionId && this.senderToken) {
      params.set('sessionId', this.sessionId);
      params.set('senderToken', this.senderToken);
    }
    const url = `${this.baseUrl}/session?${params.toString()}`;
    this.openSocket(url);
  }

  openSocket(url) {
    if (this.socket) {
      this.cleanSocket(this.socket);
    }

    try {
      this.socket = new WebSocket(url);
    } catch (err) {
      this.emit('error', { code: 'CONNECTION_ERROR', message: err.message });
      return;
    }

    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('open');

      while (this.pendingMessages.length > 0) {
        const raw = this.pendingMessages.shift();
        try {
          this.socket.send(raw);
        } catch {
          // ignore
        }
      }
    });

    this.socket.addEventListener('message', (event) => {
      this.handleIncomingMessage(event.data);
    });

    this.socket.addEventListener('close', (event) => {
      this.stopHeartbeat();
      this.emit('close', event);
      if (!this.isManualClose && this.role === 'sender') {
        this.scheduleReconnect();
      }
    });

    this.socket.addEventListener('error', () => {
      this.emit('error', { code: 'SOCKET_ERROR', message: 'WebSocket connection failed' });
    });
  }

  handleIncomingMessage(rawData) {
    try {
      const msg = parseAndValidateMessage(rawData);

      switch (msg.type) {
        case 'ping':
          this.send('pong', {});
          break;

        case 'pong':
          this.missedHeartbeats = 0;
          break;

        case 'session.created':
          this.sessionId = msg.payload.sessionId;
          this.senderToken = msg.payload.senderToken;
          this.iceServers = msg.payload.iceServers;
          this.emit('session.created', msg.payload);
          break;

        case 'receiver.created':
          this.emit('receiver.created', msg.payload);
          break;

        case 'receiver.matched':
          this.sessionId = msg.payload.sessionId;
          this.iceServers = msg.payload.iceServers;
          this.emit('receiver.matched', msg.payload);
          // Receiver opens secondary socket to join the Session DO
          this.joinSession(msg.payload.sessionId, msg.payload.joinToken);
          break;

        case 'session.receiverMatched':
          this.emit('session.receiverMatched', msg.payload);
          break;

        case 'signal.offer':
        case 'signal.answer':
        case 'signal.ice':
          this.emit('signal', msg);
          break;

        case 'peer.left':
          this.emit('peer.left', msg.payload);
          break;

        case 'session.closed':
          this.emit('session.closed', msg.payload);
          break;

        case 'error':
          this.emit('error', msg.payload);
          break;

        default:
          this.emit('message', msg);
      }
    } catch (err) {
      this.emit('error', { code: 'BAD_MESSAGE', message: err.message });
    }
  }

  /**
   * Receiver opens second WebSocket to join session (TRD 5.1)
   */
  joinSession(sessionId, joinToken) {
    if (!this.pendingJoinMessages) this.pendingJoinMessages = [];
    const url = `${this.baseUrl}/join?sessionId=${sessionId}&joinToken=${joinToken}`;
    this.joinSocket = new WebSocket(url);

    this.joinSocket.addEventListener('open', () => {
      while (this.pendingJoinMessages && this.pendingJoinMessages.length > 0) {
        const raw = this.pendingJoinMessages.shift();
        try {
          this.joinSocket.send(raw);
        } catch {
          // ignore
        }
      }
      this.emit('joined', { sessionId, joinToken });
    });

    this.joinSocket.addEventListener('message', (event) => {
      try {
        const msg = parseAndValidateMessage(event.data);
        if (msg.type === 'signal.offer' || msg.type === 'signal.answer' || msg.type === 'signal.ice') {
          this.emit('signal', msg);
        } else if (msg.type === 'peer.left' || msg.type === 'session.closed') {
          this.emit(msg.type, msg.payload);
        } else if (msg.type === 'error') {
          this.emit('error', msg.payload);
        }
      } catch (err) {
        this.emit('error', { code: 'BAD_MESSAGE', message: err.message });
      }
    });

    this.joinSocket.addEventListener('close', (event) => {
      this.emit('joinClose', event);
    });
  }

  /**
   * Send JSON message
   */
  send(type, payload = {}, id = null) {
    const isReceiverJoined = this.role === 'receiver' && this.joinSocket;
    const targetWs = isReceiverJoined ? this.joinSocket : this.socket;

    const raw = serializeMessage(type, payload, id);

    if (targetWs && targetWs.readyState === 1 /* OPEN */) {
      try {
        targetWs.send(raw);
        return true;
      } catch {
        return false;
      }
    } else if (targetWs && targetWs.readyState === 0 /* CONNECTING */) {
      if (isReceiverJoined) {
        if (!this.pendingJoinMessages) this.pendingJoinMessages = [];
        this.pendingJoinMessages.push(raw);
      } else {
        this.pendingMessages.push(raw);
      }
      return true;
    }

    return false;
  }

  /**
   * Sender adds receiver by 6-digit code
   */
  addReceiver(code) {
    return this.send('session.addReceiver', { code });
  }

  /**
   * Send WebRTC signal (SDP or ICE)
   */
  sendSignal(type, to, payload) {
    return this.send(type, { to, payload });
  }

  /**
   * Sender removes receiver
   */
  removeReceiver(receiverId) {
    return this.send('session.removeReceiver', { receiverId });
  }

  /**
   * Regenerate receiver code (RC-3)
   */
  regenerateCode() {
    return this.send('receiver.regenerate', {});
  }

  /**
   * Sender ends session
   */
  endSession() {
    this.send('session.end', {});
    this.close();
  }

  /**
   * Heartbeat handling (TRD 4.4)
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.missedHeartbeats = 0;
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === 1) {
        if (this.missedHeartbeats >= 2) {
          this.socket.close();
          return;
        }
        this.missedHeartbeats++;
        this.send('ping', {});
      }
    }, 20 * 1000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Exponential backoff reconnect for sender (TRD 12)
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', { code: 'RECONNECT_FAILED', message: 'Failed to reconnect after maximum attempts' });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.sessionId && this.senderToken) {
        this.connectSender();
      }
    }, delay);
  }

  cleanSocket(ws) {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }

  close() {
    this.isManualClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) this.cleanSocket(this.socket);
    if (this.joinSocket) this.cleanSocket(this.joinSocket);
    this.socket = null;
    this.joinSocket = null;
  }
}
