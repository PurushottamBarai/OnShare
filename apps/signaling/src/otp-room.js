import { parseAndValidateMessage, ERROR_CODES } from '@onshare/protocol';
import { sendWsMessage, createWebSocketResponse } from './utils.js';

/**
 * OtpRoom Durable Object (TRD Section 4.1 & 5.1)
 * Named by the 6-digit code.
 * Holds the waiting receiver's socket, handles expiry, and coordinates atomic consumption.
 */
export class OtpRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // In-memory state per TRD section 3 ("no database")
    this.receiverSocket = null;
    this.code = null;
    this.expiresAt = 0;
    this.roomState = 'IDLE'; // 'IDLE' | 'WAITING' | 'MATCHED' | 'EXPIRED' | 'CANCELLED'
    this.receiverId = null;
    this.expiryTimeout = null;
    this.disconnectTimeout = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // 1. Internal HTTP endpoint: Check if code is available for allocation
    if (url.pathname === '/claim-check') {
      const now = Date.now();
      const isAvailable = (
        this.roomState === 'IDLE' ||
        this.roomState === 'CANCELLED' ||
        this.roomState === 'EXPIRED' ||
        (this.expiresAt && now > this.expiresAt)
      );
      return Response.json({ available: isAvailable });
    }

    // 1b. Internal HTTP endpoint: Check if code can be resumed
    if (url.pathname === '/resume-check') {
      const now = Date.now();
      const canResume = (
        (this.roomState === 'WAITING' || this.roomState === 'IDLE' || this.roomState === 'DISCONNECTED') &&
        (this.expiresAt ? now < this.expiresAt : true)
      );
      return Response.json({ canResume, expiresAt: this.expiresAt });
    }

    if (url.pathname === '/expire') {
      this.roomState = 'EXPIRED';
      this.expiresAt = Date.now() - 1000;
      if (this.receiverSocket) {
        sendWsMessage(this.receiverSocket, 'error', {
          code: ERROR_CODES.OTP_EXPIRED,
          message: 'Code has expired',
        });
      }
      return Response.json({ success: true, expired: true });
    }

    // 2. Internal HTTP endpoint: Session consumes code
    if (url.pathname === '/consume') {
      const now = Date.now();

      if (this.roomState === 'EXPIRED' || (this.expiresAt && now > this.expiresAt)) {
        this.roomState = 'EXPIRED';
        if (this.receiverSocket) {
          sendWsMessage(this.receiverSocket, 'error', {
            code: ERROR_CODES.OTP_EXPIRED,
            message: 'Code has expired',
          });
        }
        return Response.json({
          success: false,
          error: ERROR_CODES.OTP_EXPIRED,
          message: 'Code has expired',
        }, { status: 410 });
      }

      if (this.roomState !== 'WAITING' || !this.receiverSocket) {
        return Response.json({
          success: false,
          error: ERROR_CODES.OTP_INVALID,
          message: 'Code is not active or has already been used',
        }, { status: 400 });
      }

      const body = await request.json().catch(() => ({}));
      const { sessionId, iceServers } = body;

      if (!sessionId) {
        return Response.json({
          success: false,
          error: ERROR_CODES.BAD_MESSAGE,
          message: 'Missing sessionId',
        }, { status: 400 });
      }

      // Mark matched atomically (single use)
      this.roomState = 'MATCHED';
      if (this.expiryTimeout) {
        clearTimeout(this.expiryTimeout);
        this.expiryTimeout = null;
      }

      const joinToken = crypto.randomUUID();
      const receiverId = this.receiverId || `recv_${crypto.randomUUID().slice(0, 8)}`;

      // Tell the waiting receiver it has matched
      sendWsMessage(this.receiverSocket, 'receiver.matched', {
        sessionId,
        joinToken,
        iceServers: iceServers || [],
      });

      return Response.json({
        success: true,
        receiverId,
        joinToken,
      });
    }

    // 3. WebSocket connection for the waiting receiver
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleReceiverWebSocket(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  handleReceiverWebSocket(request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') || this.code;

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

    this.setupReceiverSocket(server, code);

    return createWebSocketResponse(client);
  }

  setupReceiverSocket(serverWs, code) {
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }

    // If there was an existing receiver socket, clean it up
    if (this.receiverSocket && this.receiverSocket !== serverWs) {
      try {
        this.receiverSocket.close();
      } catch {
        // ignore
      }
    }

    const now = Date.now();
    const isResuming = (this.code === code && this.expiresAt > now);

    this.receiverSocket = serverWs;
    this.code = code;
    this.roomState = 'WAITING';
    if (!this.receiverId || !isResuming) {
      this.receiverId = `recv_${crypto.randomUUID().slice(0, 8)}`;
    }

    // 10 minutes validity - retain remaining time if resuming, otherwise set new 10 min
    if (!isResuming || !this.expiresAt) {
      this.expiresAt = now + 10 * 60 * 1000;
    }

    // Send receiver.created
    sendWsMessage(serverWs, 'receiver.created', {
      code: this.code,
      expiresAt: this.expiresAt,
    });

    // Schedule expiry timer
    if (this.expiryTimeout) {
      clearTimeout(this.expiryTimeout);
    }
    const remainingMs = Math.max(1000, this.expiresAt - now);
    this.expiryTimeout = setTimeout(() => {
      if (this.roomState === 'WAITING' || this.roomState === 'DISCONNECTED') {
        this.roomState = 'EXPIRED';
        sendWsMessage(this.receiverSocket, 'error', {
          code: ERROR_CODES.OTP_EXPIRED,
          message: 'Receiver code expired after 10 minutes',
        });
        try {
          this.receiverSocket?.close();
        } catch {
          // ignore
        }
      }
    }, remainingMs);
    this.expiryTimeout?.unref?.();

    serverWs.addEventListener('message', async (event) => {
      try {
        const msg = parseAndValidateMessage(event.data);

        switch (msg.type) {
          case 'ping':
            sendWsMessage(serverWs, 'pong', {}, msg.id);
            break;

          case 'receiver.regenerate':
            // Invalidate old code and notify caller
            this.roomState = 'CANCELLED';
            if (this.expiryTimeout) {
              clearTimeout(this.expiryTimeout);
              this.expiryTimeout = null;
            }
            if (this.disconnectTimeout) {
              clearTimeout(this.disconnectTimeout);
              this.disconnectTimeout = null;
            }
            sendWsMessage(serverWs, 'error', {
              code: 'CODE_REGENERATED',
              message: 'Code invalidated; create a new receiver code',
            });
            break;

          default:
            // Unexpected messages on OTP socket
            sendWsMessage(serverWs, 'error', {
              code: ERROR_CODES.BAD_MESSAGE,
              message: `Unexpected message type in OtpRoom: ${msg.type}`,
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
      if (this.receiverSocket === serverWs) {
        this.receiverSocket = null;
        if (this.roomState === 'WAITING') {
          this.roomState = 'DISCONNECTED';
          if (this.disconnectTimeout) {
            clearTimeout(this.disconnectTimeout);
          }
          this.disconnectTimeout = setTimeout(() => {
            if (this.roomState === 'DISCONNECTED') {
              this.roomState = 'CANCELLED';
              if (this.expiryTimeout) {
                clearTimeout(this.expiryTimeout);
                this.expiryTimeout = null;
              }
            }
          }, 60000);
          this.disconnectTimeout?.unref?.();
        }
      }
    });
  }
}
