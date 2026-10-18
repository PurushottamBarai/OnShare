import { parseAndValidateMessage, serializeMessage } from '@onshare/protocol';

export class SignalingClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || this.getDefaultSignalingUrl();
    this.role = null;
    this.socket = null;
    this.joinSocket = null;
    this.listeners = new Map();

    this.sessionId = null;
    this.senderToken = null;
    this.iceServers = [];

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
          void 0;
        }
      });
    }
  }

  getWorkerIndex() {
    if (typeof window !== 'undefined') {
      return (
        window.__TEST_WORKER_INDEX__ ||
        new URLSearchParams(window.location.search).get('workerIndex') ||
        (document.cookie.match(/(?:^|;\s*)test_worker_index=([^;]+)/)?.[1]) ||
        ''
      );
    }
    return '';
  }

  connectReceiver(options = {}) {
    this.role = 'receiver';
    this.isManualClose = false;
    const params = new URLSearchParams();
    const workerIndex = this.getWorkerIndex();
    if (workerIndex) {
      params.set('workerIndex', workerIndex);
    }
    if (options.resumeCode) {
      params.set('resumeCode', options.resumeCode);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `${this.baseUrl}/receiver${query}`;
    this.openSocket(url);
  }

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
    const workerIndex = this.getWorkerIndex();
    if (workerIndex) {
      params.set('workerIndex', workerIndex);
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
          void 0;
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

        case 'session.broadcastCreated':
          this.emit('session.broadcastCreated', msg.payload);
          break;

        case 'receiver.matched':
          this.sessionId = msg.payload.sessionId;
          this.iceServers = msg.payload.iceServers;
          this.emit('receiver.matched', msg.payload);
          this.joinSession(msg.payload.sessionId, msg.payload.joinToken);
          break;

        case 'session.receiverMatched':
          if (msg.payload?.iceServers && Array.isArray(msg.payload.iceServers) && msg.payload.iceServers.length > 0) {
            this.iceServers = msg.payload.iceServers;
          }
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

  joinSession(sessionId, joinToken) {
    if (this.joinSocket) {
      this.cleanSocket(this.joinSocket);
      this.joinSocket = null;
    }
    if (!this.pendingJoinMessages) this.pendingJoinMessages = [];
    const workerIndex = this.getWorkerIndex();
    const workerParam = workerIndex ? `&workerIndex=${workerIndex}` : '';
    const url = `${this.baseUrl}/join?sessionId=${sessionId}&joinToken=${joinToken}${workerParam}`;
    this.joinSocket = new WebSocket(url);

    this.joinSocket.addEventListener('open', () => {
      while (this.pendingJoinMessages && this.pendingJoinMessages.length > 0) {
        const raw = this.pendingJoinMessages.shift();
        try {
          this.joinSocket.send(raw);
        } catch {
          void 0;
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
      this.joinSocket = null;
      this.emit('joinClose', event);
    });
  }

  send(type, payload = {}, id = null) {
    const isOtpType = typeof type === 'string' && type.startsWith('receiver.');
    const isReceiverJoined = !isOtpType && this.role === 'receiver' && this.joinSocket && this.joinSocket.readyState !== 2 && this.joinSocket.readyState !== 3;
    const targetWs = isReceiverJoined ? this.joinSocket : this.socket;

    const raw = serializeMessage(type, payload, id);

    if (targetWs && targetWs.readyState === 1) {
      try {
        targetWs.send(raw);
        return true;
      } catch {
        return false;
      }
    } else if (targetWs && targetWs.readyState === 0) {
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

  addReceiver(code) {
    return this.send('session.addReceiver', { code });
  }

  createBroadcastCode() {
    return this.send('session.createBroadcast', {});
  }

  regenerateBroadcast() {
    return this.send('session.regenerateBroadcast', {});
  }

  invalidateBroadcast() {
    return this.send('session.invalidateBroadcast', {});
  }

  joinBroadcast(code) {
    return this.send('receiver.joinCode', { code });
  }

  sendSignal(type, to, payload) {
    return this.send(type, { to, payload });
  }

  removeReceiver(receiverId) {
    return this.send('session.removeReceiver', { receiverId });
  }

  regenerateCode() {
    return this.send('receiver.regenerate', {});
  }

  endSession() {
    this.send('session.end', {});
    this.close();
  }

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
    if (this.heartbeatInterval?.unref) this.heartbeatInterval.unref();
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

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
    if (this.reconnectTimer?.unref) this.reconnectTimer.unref();
  }

  cleanSocket(ws) {
    try {
      ws.close();
    } catch {
      void 0;
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
