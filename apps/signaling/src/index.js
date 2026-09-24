/**
 * SharePort Signaling Service (Cloudflare Workers + Durable Objects)
 * Plain JavaScript (ES2022+) per TRD Sections 3, 4, 5, 6
 */

import { OtpRoom } from './otp-room.js';
import { Session } from './session.js';
import { Limiter } from './limiter.js';
import { generate6DigitCode, hashAddress, getClientIp } from './utils.js';

export { OtpRoom, Session, Limiter };

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    // Plain switch on the URL path (TRD section 5.1 - no Express)
    switch (url.pathname) {
      // 1. Health check route
      case '/health': {
        return Response.json({
          status: 'ok',
          service: 'shareport-signaling',
          timestamp: Date.now(),
        });
      }

      // 2. Receiver WebSocket connection (generates and binds 6-digit code)
      case '/ws/receiver': {
        if (request.headers.get('Upgrade') !== 'websocket') {
          return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        // Network address rate limit check (TRD 4.2)
        const ip = getClientIp(request);
        const ipHash = await hashAddress(ip);

        if (env?.LIMITER) {
          const limiterStub = env.LIMITER.get(env.LIMITER.idFromName(ipHash));
          const checkRes = await limiterStub.fetch(new Request('http://internal/check', {
            method: 'POST',
            body: JSON.stringify({ action: 'create_code' }),
          }));

          if (!checkRes.ok) {
            const err = await checkRes.json().catch(() => ({}));
            return Response.json(err, { status: 429 });
          }

          // Record code creation
          await limiterStub.fetch(new Request('http://internal/record', {
            method: 'POST',
            body: JSON.stringify({ type: 'create_code' }),
          }));
        }

        // Draw unique 6-digit code with up to 5 tries (TRD 4.1)
        let selectedCode = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = generate6DigitCode();
          if (!env?.OTP_ROOM) {
            selectedCode = candidate;
            break;
          }

          const otpStub = env.OTP_ROOM.get(env.OTP_ROOM.idFromName(candidate));
          const checkRes = await otpStub.fetch(new Request('http://internal/claim-check'));
          const checkData = await checkRes.json().catch(() => ({ available: false }));

          if (checkData.available) {
            selectedCode = candidate;
            break;
          }
        }

        if (!selectedCode) {
          return Response.json({ error: 'Failed to allocate unique code. Please retry.' }, { status: 503 });
        }

        // Forward to OtpRoom DO
        const targetUrl = new URL(request.url);
        targetUrl.searchParams.set('code', selectedCode);

        const otpRoomStub = env.OTP_ROOM.get(env.OTP_ROOM.idFromName(selectedCode));
        return otpRoomStub.fetch(new Request(targetUrl.toString(), request));
      }

      // 3. Sender WebSocket connection (creates or reclaims session)
      case '/ws/session': {
        if (request.headers.get('Upgrade') !== 'websocket') {
          return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        const sessionIdParam = url.searchParams.get('sessionId');
        const senderToken = url.searchParams.get('senderToken');
        const isReconnect = Boolean(sessionIdParam && senderToken);

        // Rate check only on new sessions
        if (!isReconnect && env?.LIMITER) {
          const ip = getClientIp(request);
          const ipHash = await hashAddress(ip);
          const limiterStub = env.LIMITER.get(env.LIMITER.idFromName(ipHash));
          const checkRes = await limiterStub.fetch(new Request('http://internal/check', {
            method: 'POST',
            body: JSON.stringify({ action: 'create_session' }),
          }));

          if (!checkRes.ok) {
            const err = await checkRes.json().catch(() => ({}));
            return Response.json(err, { status: 429 });
          }

          await limiterStub.fetch(new Request('http://internal/record', {
            method: 'POST',
            body: JSON.stringify({ type: 'create_session' }),
          }));
        }

        const sessionId = sessionIdParam || `sess_${crypto.randomUUID().slice(0, 8)}`;
        const targetUrl = new URL(request.url);
        targetUrl.searchParams.set('sessionId', sessionId);
        targetUrl.searchParams.set('role', 'sender');

        const sessionStub = env.SESSION.get(env.SESSION.idFromName(sessionId));
        return sessionStub.fetch(new Request(targetUrl.toString(), request));
      }

      // 4. Receiver join WebSocket connection (after match)
      case '/ws/join': {
        if (request.headers.get('Upgrade') !== 'websocket') {
          return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        const sessionId = url.searchParams.get('sessionId');
        const joinToken = url.searchParams.get('joinToken');

        if (!sessionId || !joinToken) {
          return new Response('Missing sessionId or joinToken', { status: 400 });
        }

        const targetUrl = new URL(request.url);
        targetUrl.searchParams.set('role', 'receiver');

        const sessionStub = env.SESSION.get(env.SESSION.idFromName(sessionId));
        return sessionStub.fetch(new Request(targetUrl.toString(), request));
      }

      default:
        return new Response('SharePort Signaling Service', { status: 200 });
    }
  }
};
