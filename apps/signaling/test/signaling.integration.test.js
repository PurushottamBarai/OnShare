import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { OtpRoom, Session, Limiter } from '../src/index.js';
import { ERROR_CODES, parseAndValidateMessage, serializeMessage } from '@onshare/protocol';

/**
 * Mock WebSocket pair for Vitest Node / jsdom environment
 */
class MockWebSocket extends EventTarget {
  constructor() {
    super();
    this.readyState = 1; // OPEN
    this.peer = null;
  }

  send(data) {
    if (this.peer && this.peer.readyState === 1) {
      setTimeout(() => {
        this.peer.dispatchEvent(new MessageEvent('message', { data }));
      }, 0);
    }
  }

  close(code = 1000, reason = '') {
    this.readyState = 3; // CLOSED
    if (this.peer) {
      this.peer.readyState = 3;
      setTimeout(() => {
        this.peer.dispatchEvent(new CloseEvent('close', { code, reason }));
      }, 0);
    }
  }
}

function createMockWebSocketPair() {
  const client = new MockWebSocket();
  const server = new MockWebSocket();
  client.peer = server;
  server.peer = client;
  return [client, server];
}

/**
 * Mock Durable Object Namespace
 */
class MockDONamespace {
  constructor(ClassConstructor, env) {
    this.ClassConstructor = ClassConstructor;
    this.instances = new Map();
    this.env = env;
  }

  idFromName(name) {
    return { name, toString: () => name };
  }

  get(id) {
    const key = id.name || id.toString();
    if (!this.instances.has(key)) {
      const state = { id, storage: new Map() };
      this.instances.set(key, new this.ClassConstructor(state, this.env));
    }
    const instance = this.instances.get(key);
    return {
      fetch: (req) => instance.fetch(req),
      instance,
    };
  }
}

/**
 * Helper to wait for a specific message type on a client WebSocket
 */
function waitForMessage(ws, type, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type "${type}"`));
    }, timeout);

    const onMessage = (event) => {
      try {
        const msg = parseAndValidateMessage(event.data);
        if (msg.type === type) {
          clearTimeout(timer);
          ws.removeEventListener('message', onMessage);
          resolve(msg);
        }
      } catch {
        // ignore other messages
      }
    };

    ws.addEventListener('message', onMessage);
  });
}

describe('Signaling Service Integration Flows (TRD Section 15)', () => {
  let env;

  beforeEach(() => {
    env = {
      createWebSocketPair: createMockWebSocketPair,
      TURN_SECRET: 'test-turn-secret',
      TURN_DOMAIN: 'turn.test.local',
    };
    env.OTP_ROOM = new MockDONamespace(OtpRoom, env);
    env.SESSION = new MockDONamespace(Session, env);
    env.LIMITER = new MockDONamespace(Limiter, env);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // 1. MATCH FLOW (TRD 2.1 & 5.1)
  it('covers MATCH flow: receiver gets code, sender enters code, receiver matches and joins, signals relay', async () => {
    // A. Receiver connects to /ws/receiver
    const receiverReq = new Request('https://signaling.local/ws/receiver', {
      headers: { Upgrade: 'websocket', 'x-forwarded-for': '1.2.3.4' },
    });
    const receiverRes = await worker.fetch(receiverReq, env);
    expect(receiverRes.status).toBe(101);
    const receiverWs = receiverRes.webSocket;

    // Receiver should receive receiver.created with 6-digit code
    const createdMsg = await waitForMessage(receiverWs, 'receiver.created');
    const { code } = createdMsg.payload;
    expect(code).toMatch(/^\d{6}$/);

    // B. Sender connects to /ws/session
    const senderReq = new Request('https://signaling.local/ws/session?validity=30&mode=files', {
      headers: { Upgrade: 'websocket', 'x-forwarded-for': '5.6.7.8' },
    });
    const senderRes = await worker.fetch(senderReq, env);
    expect(senderRes.status).toBe(101);
    const senderWs = senderRes.webSocket;

    // Sender should receive session.created with sessionId and time-limited ICE servers
    const sessionCreatedMsg = await waitForMessage(senderWs, 'session.created');
    const { sessionId, senderToken, iceServers } = sessionCreatedMsg.payload;
    expect(sessionId).toBeDefined();
    expect(senderToken).toBeDefined();
    expect(iceServers.length).toBeGreaterThanOrEqual(2);

    // C. Sender adds receiver by entering the code
    senderWs.send(serializeMessage('session.addReceiver', { code }));

    // Receiver receives receiver.matched with joinToken and iceServers
    const matchedMsg = await waitForMessage(receiverWs, 'receiver.matched');
    expect(matchedMsg.payload.sessionId).toBe(sessionId);
    expect(matchedMsg.payload.joinToken).toBeDefined();
    expect(matchedMsg.payload.iceServers.length).toBeGreaterThanOrEqual(2);

    // Sender receives session.receiverMatched with receiverId
    const senderMatchedMsg = await waitForMessage(senderWs, 'session.receiverMatched');
    const { receiverId } = senderMatchedMsg.payload;
    expect(receiverId).toMatch(/^recv_/);

    // D. Receiver opens second WebSocket to join session
    const joinReq = new Request(`https://signaling.local/ws/join?sessionId=${sessionId}&joinToken=${matchedMsg.payload.joinToken}`, {
      headers: { Upgrade: 'websocket' },
    });
    const joinRes = await worker.fetch(joinReq, env);
    expect(joinRes.status).toBe(101);
    const joinedReceiverWs = joinRes.webSocket;

    // E. Verify WebRTC signaling relay between sender and receiver
    senderWs.send(serializeMessage('signal.offer', {
      to: receiverId,
      payload: { sdp: 'mock-offer-sdp' },
    }));

    const receivedOffer = await waitForMessage(joinedReceiverWs, 'signal.offer');
    expect(receivedOffer.payload.payload).toEqual({ sdp: 'mock-offer-sdp' });

    joinedReceiverWs.send(serializeMessage('signal.answer', {
      to: 'sender',
      payload: { sdp: 'mock-answer-sdp' },
    }));

    const receivedAnswer = await waitForMessage(senderWs, 'signal.answer');
    expect(receivedAnswer.payload.payload).toEqual({ sdp: 'mock-answer-sdp' });
  });

  // 2. WRONG CODE FLOW (TRD 4.2 & 15)
  it('covers WRONG CODE flow: invalid code triggers error, 5 failures lock entry per session', async () => {
    const senderReq = new Request('https://signaling.local/ws/session', {
      headers: { Upgrade: 'websocket', 'x-forwarded-for': '9.9.9.9' },
    });
    const senderRes = await worker.fetch(senderReq, env);
    const senderWs = senderRes.webSocket;
    await waitForMessage(senderWs, 'session.created');

    // Attempt invalid codes 4 times -> should return OTP_INVALID error
    for (let i = 0; i < 4; i++) {
      senderWs.send(serializeMessage('session.addReceiver', { code: '000000' }));
      const err = await waitForMessage(senderWs, 'error');
      expect(err.payload.code).toBe(ERROR_CODES.OTP_INVALID);
    }

    // 5th attempt triggers RATE_LIMITED lockout for 60 seconds (TRD 4.2)
    senderWs.send(serializeMessage('session.addReceiver', { code: '000000' }));
    const lockErr = await waitForMessage(senderWs, 'error');
    expect(lockErr.payload.code).toBe(ERROR_CODES.RATE_LIMITED);
    expect(lockErr.payload.retryAfter).toBe(60);
  });

  // 3. EXPIRY FLOW (TRD 4.1, 4.4 & 15)
  it('covers EXPIRY flow: expired code is rejected and informs sender', async () => {
    // Create receiver
    const receiverReq = new Request('https://signaling.local/ws/receiver', {
      headers: { Upgrade: 'websocket' },
    });
    const receiverRes = await worker.fetch(receiverReq, env);
    const receiverWs = receiverRes.webSocket;
    const createdMsg = await waitForMessage(receiverWs, 'receiver.created');
    const { code } = createdMsg.payload;

    // Simulate expiration of the OTP code (TRD 4.1: past 10 minutes)
    const otpStub = env.OTP_ROOM.get(env.OTP_ROOM.idFromName(code));
    otpStub.instance.expiresAt = Date.now() - 1000;

    // Sender connects and tries to claim the expired code
    const senderReq = new Request('https://signaling.local/ws/session', {
      headers: { Upgrade: 'websocket' },
    });
    const senderRes = await worker.fetch(senderReq, env);
    const senderWs = senderRes.webSocket;
    await waitForMessage(senderWs, 'session.created');

    senderWs.send(serializeMessage('session.addReceiver', { code }));
    const errorMsg = await waitForMessage(senderWs, 'error');
    expect(errorMsg.payload.code).toBe(ERROR_CODES.OTP_EXPIRED);
  });

  // 4. RECONNECT FLOW (TRD 4.4 & 15)
  it('covers RECONNECT flow: sender disconnects and reclaims session within 60s grace period', async () => {
    // Sender creates session
    const senderReq1 = new Request('https://signaling.local/ws/session', {
      headers: { Upgrade: 'websocket' },
    });
    const senderRes1 = await worker.fetch(senderReq1, env);
    const senderWs1 = senderRes1.webSocket;
    const { sessionId, senderToken } = (await waitForMessage(senderWs1, 'session.created')).payload;

    // Sender closes socket (simulating temporary disconnect or network drop)
    senderWs1.close();

    // Sender reconnects within 60-second grace period presenting sessionId and senderToken
    const reconnectReq = new Request(
      `https://signaling.local/ws/session?sessionId=${sessionId}&senderToken=${senderToken}`,
      { headers: { Upgrade: 'websocket' } }
    );
    const reconnectRes = await worker.fetch(reconnectReq, env);
    expect(reconnectRes.status).toBe(101);
    const senderWs2 = reconnectRes.webSocket;

    const reconnectedMsg = await waitForMessage(senderWs2, 'session.created');
    expect(reconnectedMsg.payload.sessionId).toBe(sessionId);
    expect(reconnectedMsg.payload.senderToken).toBe(senderToken);

    // Verify session remains functional
    senderWs2.send(serializeMessage('ping', {}));
    const pong = await waitForMessage(senderWs2, 'pong');
    expect(pong.type).toBe('pong');
  });

  // 5. SESSION CLOSE FLOW (TRD 4.3, 7.6 & 15)
  it('covers SESSION CLOSE flow: sender ending session cleanly closes joined receivers', async () => {
    // Setup matched session
    const receiverReq = new Request('https://signaling.local/ws/receiver', {
      headers: { Upgrade: 'websocket' },
    });
    const receiverRes = await worker.fetch(receiverReq, env);
    const receiverWs = receiverRes.webSocket;
    const { code } = (await waitForMessage(receiverWs, 'receiver.created')).payload;

    const senderReq = new Request('https://signaling.local/ws/session', {
      headers: { Upgrade: 'websocket' },
    });
    const senderRes = await worker.fetch(senderReq, env);
    const senderWs = senderRes.webSocket;
    const { sessionId } = (await waitForMessage(senderWs, 'session.created')).payload;

    senderWs.send(serializeMessage('session.addReceiver', { code }));
    const { joinToken } = (await waitForMessage(receiverWs, 'receiver.matched')).payload;

    const joinReq = new Request(`https://signaling.local/ws/join?sessionId=${sessionId}&joinToken=${joinToken}`, {
      headers: { Upgrade: 'websocket' },
    });
    const joinedReceiverWs = (await worker.fetch(joinReq, env)).webSocket;

    // Sender sends session.end
    senderWs.send(serializeMessage('session.end', {}));

    // Joined receiver should receive session.closed
    const closedMsg = await waitForMessage(joinedReceiverWs, 'session.closed');
    expect(closedMsg.payload.reason).toBe('sender_ended');
  });

  // 6. CAPS FLOW (TRD 4.2 & 15)
  it('covers CAPS flow: enforces maximum 10 receivers per session', async () => {
    const senderReq = new Request('https://signaling.local/ws/session', {
      headers: { Upgrade: 'websocket' },
    });
    const senderRes = await worker.fetch(senderReq, env);
    const senderWs = senderRes.webSocket;
    await waitForMessage(senderWs, 'session.created');

    // Simulate 10 receivers matched
    for (let i = 0; i < 10; i++) {
      const recvReq = new Request('https://signaling.local/ws/receiver', {
        headers: { Upgrade: 'websocket' },
      });
      const recvRes = await worker.fetch(recvReq, env);
      const { code } = (await waitForMessage(recvRes.webSocket, 'receiver.created')).payload;

      senderWs.send(serializeMessage('session.addReceiver', { code }));
      await waitForMessage(senderWs, 'session.receiverMatched');
    }

    // 11th receiver attempt must be rejected with SESSION_FULL
    const extraRecvReq = new Request('https://signaling.local/ws/receiver', {
      headers: { Upgrade: 'websocket' },
    });
    const extraRecvRes = await worker.fetch(extraRecvReq, env);
    const { code: extraCode } = (await waitForMessage(extraRecvRes.webSocket, 'receiver.created')).payload;

    senderWs.send(serializeMessage('session.addReceiver', { code: extraCode }));
    const capErr = await waitForMessage(senderWs, 'error');
    expect(capErr.payload.code).toBe(ERROR_CODES.SESSION_FULL);
  });

  // 7. OTP RESUME FLOW
  it('preserves receiver OTP code across disconnects and reloads when resumeCode is passed', async () => {
    // 1. Initial receiver connects
    const recvReq1 = new Request('https://signaling.local/ws/receiver', {
      headers: { Upgrade: 'websocket' },
    });
    const recvRes1 = await worker.fetch(recvReq1, env);
    const recvWs1 = recvRes1.webSocket;
    const { code: originalCode, expiresAt: originalExpiresAt } = (await waitForMessage(recvWs1, 'receiver.created')).payload;

    // Simulate page refresh / tab reload (close old socket)
    recvWs1.close();

    // 2. Receiver reconnects with resumeCode
    const recvReq2 = new Request(`https://signaling.local/ws/receiver?resumeCode=${originalCode}`, {
      headers: { Upgrade: 'websocket' },
    });
    const recvRes2 = await worker.fetch(recvReq2, env);
    const recvWs2 = recvRes2.webSocket;
    const { code: resumedCode, expiresAt: resumedExpiresAt } = (await waitForMessage(recvWs2, 'receiver.created')).payload;

    expect(resumedCode).toBe(originalCode);
    expect(resumedExpiresAt).toBe(originalExpiresAt);
  });
});
