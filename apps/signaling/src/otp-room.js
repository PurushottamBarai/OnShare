import { parseAndValidateMessage, ERROR_CODES } from '@shareport/protocol';
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

    // 2. Internal HTTP endpoint: Session consumes code
    if (url.pathname === '/consume') {
      const now = Date.now();
      if (this.roomState !== 'WAITING' || !this.receiverSocket) {
        return Response.json({
          success: false,
          error: ERROR_CODES.OTP_INVALID,
          message: 'Code is not active or has already been used',
        }, { status: 400 });
      }

      if (now > this.expiresAt) {
        this.roomState = 'EXPIRED';
        sendWsMessage(this.receiverSocket, 'error', {
          code: ERROR_CODES.OTP_EXPIRED,
          message: 'Code has expired',
        });
        return Response.json({
          success: false,
          error: ERROR_CODES.OTP_EXPIRED,
          message: 'Code has expired',
        }, { status: 410 });
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
    if (typeof WebSocketPair !== 'undefined') {
      const pair = new WebSocketPair();
      client = pair[0];
      server = pair[1];
    } else if (this.env?.createWebSocketPair) {
      const pair = this.env.createWebSocketPair();
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
    // If there was an existing receiver socket, clean it up
    if (this.receiverSocket && this.receiverSocket !== serverWs) {
      try {
        this.receiverSocket.close();
      } catch {
        // ignore
      }
    }

    this.receiverSocket = serverWs;
    this.code = code;
    this.roomState = 'WAITING';
    this.receiverId = `recv_${crypto.randomUUID().slice(0, 8)}`;
    // 10 minutes validity (TRD section 4.1 & 4.4)
    this.expiresAt = Date.now() + 10 * 60 * 1000;

    // Send receiver.created
    sendWsMessage(serverWs, 'receiver.created', {
      code: this.code,
      expiresAt: this.expiresAt,
    });

    // Schedule 10-minute expiry timer
    if (this.expiryTimeout) {
      clearTimeout(this.expiryTimeout);
    }
    this.expiryTimeout = setTimeout(() => {
      if (this.roomState === 'WAITING') {
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
    }, 10 * 60 * 1000);

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
      if (this.roomState === 'WAITING') {
        // Disconnecting invalidates the code at once (TRD section 4.1)
        this.roomState = 'CANCELLED';
      }
      if (this.expiryTimeout) {
        clearTimeout(this.expiryTimeout);
        this.expiryTimeout = null;
      }
      this.receiverSocket = null;
    });
  }
}
