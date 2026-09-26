import { parseAndValidateMessage, ERROR_CODES } from '@onshare/protocol';
import { sendWsMessage, createWebSocketResponse } from './utils.js';
import { generateIceServers } from './turn.js';

/**
 * Session Durable Object (TRD Section 4.3, 4.4, 5.1)
 * Holds sender socket and joined receiver sockets.
 * Relays SDP/ICE, manages caps, enforces session rate limits and timers.
 */
export class Session {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    this.sessionId = null;
    this.senderToken = null;
    this.senderSocket = null;
    this.mode = 'files'; // 'files' | 'text'
    this.sessionState = 'CREATED'; // 'CREATED' | 'ACTIVE' | 'CLOSING' | 'CLOSED'

    // Receivers map: receiverId -> { joinToken, socket, state, matchedAt }
    this.receivers = new Map();

    // Session-level failed code attempts: max 5 per minute (TRD section 4.2)
    this.failedCodeAttempts = [];
    this.sessionLockoutUntil = 0;

    // Caps
    this.maxReceivers = 10; // Default cap 10, hard cap 20 (TRD 4.2)

    // Timers
    this.validityMinutes = 60; // Default 60 minutes
    this.sessionTimeout = null;
    this.senderGraceTimeout = null;

    // Buffer for early signaling messages (offers/ICE) arriving before receiver joins socket
    this.pendingSignals = new Map(); // receiverId -> Array<{ type, payload, id }>
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Internal HTTP endpoint: inspect session status (useful for health and tests)
    if (url.pathname === '/status') {
      return Response.json({
        sessionId: this.sessionId,
        sessionState: this.sessionState,
        mode: this.mode,
        receiverCount: this.receivers.size,
        hasSender: !!this.senderSocket,
      });
    }

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleWebSocketUpgrade(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role'); // 'sender' or 'receiver'
    const sessionId = url.searchParams.get('sessionId');
    const senderToken = url.searchParams.get('senderToken');
    const joinToken = url.searchParams.get('joinToken');

    // Platform WebSocket pair creation
    let client, server;
    if (this.env?.createWebSocketPair) {
      const pair = this.env.createWebSocketPair();
      client = pair[0];
      server = pair[1];
    } else if (typeof WebSocketPair !== 'undefined') {
      const pair = new WebSocketPair();
      client = pair[0];
      server = pair[1];
    } else {
      return new Response('WebSocketPair not supported', { status: 500 });
    }

    if (server.accept) {
      server.accept();
    }

    if (role === 'sender') {
      await this.setupSenderSocket(server, sessionId, senderToken, url);
    } else if (role === 'receiver') {
      await this.setupReceiverSocket(server, sessionId, joinToken);
    } else {
      server.close(1008, 'Unknown role');
      return new Response('Invalid role', { status: 400 });
    }

    return createWebSocketResponse(client);
  }

  async setupSenderSocket(serverWs, sessionId, senderToken, url) {
    this.sessionId = sessionId || this.sessionId || `sess_${crypto.randomUUID().slice(0, 8)}`;
    this.workerNamespace = url.searchParams.get('workerNamespace') || process.env.TEST_WORKER_INDEX || 'default';

    // Reconnecting sender check (TRD 4.4: 60-second grace period)
    if (senderToken && this.senderToken) {
      if (senderToken !== this.senderToken) {
        sendWsMessage(serverWs, 'error', {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid sender token for reconnection',
        });
        serverWs.close();
        return;
      }
      // Reconnected successfully
      if (this.senderGraceTimeout) {
        clearTimeout(this.senderGraceTimeout);
        this.senderGraceTimeout = null;
      }
      this.senderSocket = serverWs;
      this.sessionState = 'ACTIVE';
    } else {
      // New sender session
      this.senderToken = crypto.randomUUID();
      this.senderSocket = serverWs;
      this.sessionState = 'ACTIVE';

      // Parse optional validity & mode from query
      const validityParam = Number(url.searchParams.get('validity'));
      if (validityParam && [2, 5, 10, 30, 60].includes(validityParam)) {
        this.validityMinutes = validityParam;
      }
      const modeParam = url.searchParams.get('mode');
      if (modeParam === 'text' || modeParam === 'files') {
        this.mode = modeParam;
      }

      // Schedule session max lifetime timer (TRD 4.4)
      if (this.sessionTimeout) clearTimeout(this.sessionTimeout);
      this.sessionTimeout = setTimeout(() => {
        this.closeSession('session_expired');
      }, this.validityMinutes * 60 * 1000);
      this.sessionTimeout.unref();
    }

    serverWs.addEventListener('message', async (event) => {
      try {
        const msg = parseAndValidateMessage(event.data);
        await this.handleSenderMessage(msg, serverWs);
      } catch (err) {
        sendWsMessage(serverWs, 'error', {
          code: ERROR_CODES.BAD_MESSAGE,
          message: err.message || 'Malformed message',
        });
      }
    });

    // Generate ICE servers for sender
    const iceServers = await generateIceServers(this.sessionId, this.env);

    // Send session.created to sender
    sendWsMessage(serverWs, 'session.created', {
      sessionId: this.sessionId,
      senderToken: this.senderToken,
      iceServers,
    });

    serverWs.addEventListener('close', () => {
      this.senderSocket = null;
      if (this.sessionState !== 'CLOSED') {
        // Start 60-second grace period for reconnect (TRD section 4.4)
        if (this.senderGraceTimeout) clearTimeout(this.senderGraceTimeout);
        this.senderGraceTimeout = setTimeout(() => {
          if (!this.senderSocket) {
            this.closeSession('sender_left');
          }
        }, 60 * 1000);
        this.senderGraceTimeout.unref();
      }
    });
  }

  async handleSenderMessage(msg, serverWs) {
    switch (msg.type) {
      case 'ping':
        sendWsMessage(serverWs, 'pong', {}, msg.id);
        break;

      case 'session.addReceiver': {
        const { code } = msg.payload;
        await this.handleAddReceiver(code, msg.id);
        break;
      }

      case 'signal.offer':
      case 'signal.answer':
      case 'signal.ice': {
        const { to, payload } = msg.payload;
        const receiver = this.receivers.get(to);
        if (receiver) {
          const signalPayload = {
            to,
            from: 'sender',
            payload,
          };
          if (receiver.socket) {
            sendWsMessage(receiver.socket, msg.type, signalPayload, msg.id);
          } else {
            // Buffer early signal until receiver connects to /ws/join
            if (!this.pendingSignals.has(to)) {
              this.pendingSignals.set(to, []);
            }
            this.pendingSignals.get(to).push({
              type: msg.type,
              payload: signalPayload,
              id: msg.id,
            });
          }
        } else {
          sendWsMessage(serverWs, 'error', {
            code: ERROR_CODES.PEER_UNREACHABLE,
            message: `Receiver ${to} is not reachable`,
          }, msg.id);
        }
        break;
      }

      case 'session.removeReceiver': {
        const { receiverId } = msg.payload;
        const receiver = this.receivers.get(receiverId);
        if (receiver) {
          if (receiver.socket) {
            sendWsMessage(receiver.socket, 'peer.left', {
              peerId: receiverId,
              reason: 'removed',
            });
            try {
              receiver.socket.close();
            } catch {
              // ignore
            }
          }
          this.receivers.delete(receiverId);
        }
        break;
      }

      case 'session.end': {
        this.closeSession('sender_ended');
        break;
      }

      default:
        sendWsMessage(serverWs, 'error', {
          code: ERROR_CODES.BAD_MESSAGE,
          message: `Unhandled message type: ${msg.type}`,
        }, msg.id);
    }
  }

  async handleAddReceiver(code, msgId) {
    const now = Date.now();

    // 1. Check session state
    if (this.sessionState !== 'ACTIVE') {
      sendWsMessage(this.senderSocket, 'error', {
        code: ERROR_CODES.SESSION_EXPIRED,
        message: 'Session is not active',
      }, msgId);
      return;
    }

    // 2. Check failed code rate limit: max 5 per minute per session (TRD 4.2)
    const oneMinAgo = now - 60 * 1000;
    this.failedCodeAttempts = this.failedCodeAttempts.filter(t => t > oneMinAgo);

    if (this.sessionLockoutUntil > now) {
      const retryAfter = Math.ceil((this.sessionLockoutUntil - now) / 1000);
      sendWsMessage(this.senderSocket, 'error', {
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Too many failed code attempts. Session locked temporarily.',
        retryAfter,
      }, msgId);
      return;
    }

    if (this.failedCodeAttempts.length >= 5) {
      this.sessionLockoutUntil = now + 60 * 1000; // 1-minute lockout
      sendWsMessage(this.senderSocket, 'error', {
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Too many failed code attempts. Please wait 60 seconds.',
        retryAfter: 60,
      }, msgId);
      return;
    }

    // 3. Check receiver cap: max 10 per session (TRD 4.2)
    if (this.receivers.size >= this.maxReceivers) {
      sendWsMessage(this.senderSocket, 'error', {
        code: ERROR_CODES.SESSION_FULL,
        message: `Maximum receivers (${this.maxReceivers}) reached for this session`,
      }, msgId);
      return;
    }

    // 4. Contact OtpRoom to consume the code (TRD 5.1)
    if (!this.env?.OTP_ROOM) {
      sendWsMessage(this.senderSocket, 'error', {
        code: ERROR_CODES.OTP_INVALID,
        message: 'OTP Room service not available',
      }, msgId);
      return;
    }

    const iceServers = await generateIceServers(this.sessionId, this.env);
    const otpKey = this.workerNamespace && this.workerNamespace !== 'default'
      ? `${this.workerNamespace}:${code}`
      : code;
    const otpRoomId = this.env.OTP_ROOM.idFromName(otpKey);
    const otpStub = this.env.OTP_ROOM.get(otpRoomId);

    const consumeResponse = await otpStub.fetch(new Request('http://internal/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        iceServers,
      }),
    }));

    const result = await consumeResponse.json().catch(() => ({}));

    if (!consumeResponse.ok || !result.success) {
      this.failedCodeAttempts.push(now);
      if (this.failedCodeAttempts.length >= 5) {
        this.sessionLockoutUntil = now + 60 * 1000;
        sendWsMessage(this.senderSocket, 'error', {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many failed code attempts. Session locked temporarily.',
          retryAfter: 60,
        }, msgId);
        return;
      }
      sendWsMessage(this.senderSocket, 'error', {
        code: result.error || ERROR_CODES.OTP_INVALID,
        message: result.message || 'Invalid or expired code',
      }, msgId);
      return;
    }

    // 5. Code matched! Register receiver in session
    const { receiverId, joinToken } = result;
    this.receivers.set(receiverId, {
      joinToken,
      socket: null,
      state: 'CONNECTING',
      matchedAt: now,
    });

    // Notify sender of match
    sendWsMessage(this.senderSocket, 'session.receiverMatched', {
      receiverId,
    }, msgId);
  }

  async setupReceiverSocket(serverWs, sessionId, joinToken) {
    // Find receiver entry by joinToken
    let matchedReceiverId = null;
    let matchedEntry = null;

    for (const [rId, entry] of this.receivers.entries()) {
      if (entry.joinToken === joinToken) {
        matchedReceiverId = rId;
        matchedEntry = entry;
        break;
      }
    }

    if (!matchedEntry) {
      sendWsMessage(serverWs, 'error', {
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid join token',
      });
      serverWs.close();
      return;
    }

    // Link receiver socket
    matchedEntry.socket = serverWs;
    matchedEntry.state = 'WAITING_ACCEPT';

    // Flush any pending signals buffered for this receiver
    const pending = this.pendingSignals.get(matchedReceiverId);
    if (pending && pending.length > 0) {
      for (const p of pending) {
        sendWsMessage(serverWs, p.type, p.payload, p.id);
      }
      this.pendingSignals.delete(matchedReceiverId);
    }

    serverWs.addEventListener('message', (event) => {
      try {
        const msg = parseAndValidateMessage(event.data);

        switch (msg.type) {
          case 'ping':
            sendWsMessage(serverWs, 'pong', {}, msg.id);
            break;

          case 'signal.offer':
          case 'signal.answer':
          case 'signal.ice': {
            // Forward signal to sender
            if (this.senderSocket) {
              sendWsMessage(this.senderSocket, msg.type, {
                to: 'sender',
                from: matchedReceiverId,
                payload: msg.payload.payload,
              }, msg.id);
            }
            break;
          }

          default:
            sendWsMessage(serverWs, 'error', {
              code: ERROR_CODES.BAD_MESSAGE,
              message: `Unhandled receiver message: ${msg.type}`,
            }, msg.id);
        }
      } catch (err) {
        sendWsMessage(serverWs, 'error', {
          code: ERROR_CODES.BAD_MESSAGE,
          message: err.message || 'Malformed message',
        });
      }
    });

    serverWs.addEventListener('close', () => {
      if (this.receivers.has(matchedReceiverId)) {
        this.receivers.delete(matchedReceiverId);
        if (this.senderSocket) {
          sendWsMessage(this.senderSocket, 'peer.left', {
            peerId: matchedReceiverId,
            reason: 'disconnected',
          });
        }
      }
    });
  }

  closeSession(reason = 'closed') {
    this.sessionState = 'CLOSED';

    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
    if (this.senderGraceTimeout) {
      clearTimeout(this.senderGraceTimeout);
      this.senderGraceTimeout = null;
    }

    // Notify sender
    if (this.senderSocket) {
      sendWsMessage(this.senderSocket, 'session.closed', { reason });
      try {
        this.senderSocket.close();
      } catch {
        // ignore
      }
      this.senderSocket = null;
    }

    // Notify all receivers
    for (const [, entry] of this.receivers.entries()) {
      if (entry.socket) {
        sendWsMessage(entry.socket, 'session.closed', { reason });
        try {
          entry.socket.close();
        } catch {
          // ignore
        }
      }
    }
    this.receivers.clear();
    this.pendingSignals.clear();
  }
}
