/**
 * OnShare Signaling Service (Cloudflare Workers + Durable Objects)
 * Plain JavaScript (ES2022+) per TRD Sections 3, 4, 5, 6
 */

import { OtpRoom } from './otp-room.js';
import { Session } from './session.js';
import { Limiter } from './limiter.js';
import { generate6DigitCode, hashAddress, getClientIp } from './utils.js';

function getWorkerNamespace(request, url) {
  return (
    request.headers.get('x-test-worker-index') ||
    url.searchParams.get('workerIndex') ||
    process.env.TEST_WORKER_INDEX ||
    'default'
  );
}

function getOtpKey(code, namespace) {
  return namespace && namespace !== 'default' ? `${namespace}:${code}` : code;
}

function getLimiterKey(ipHash, namespace) {
  return namespace && namespace !== 'default' ? `${namespace}:${ipHash}` : ipHash;
}

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
          service: 'onshare-signaling',
          timestamp: Date.now(),
        });
      }

      // Testing helper: expire an active code
      case '/test/expire-code': {
        const code = url.searchParams.get('code');
        if (!code || !env?.OTP_ROOM) {
          return new Response('Missing code', { status: 400 });
        }
        const namespace = getWorkerNamespace(request, url);
        const otpKey = getOtpKey(code, namespace);
        const otpStub = env.OTP_ROOM.get(env.OTP_ROOM.idFromName(otpKey));
        return otpStub.fetch(new Request('http://internal/expire'));
      }

      // Testing helper: reset rate limiter state
      case '/test/reset-limiter': {
        const namespace = getWorkerNamespace(request, url);
        if (env?.LIMITER?.clear) {
          env.LIMITER.clear(namespace);
        }
        return Response.json({ success: true, reset: true, namespace });
      }

      // 2. Receiver WebSocket connection (generates and binds 6-digit code)
      case '/ws/receiver': {
        if (request.headers.get('Upgrade') !== 'websocket') {
          return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        const namespace = getWorkerNamespace(request, url);
        // Network address rate limit check (TRD 4.2)
        const ip = getClientIp(request);
        const ipHash = await hashAddress(ip);
        const limiterKey = getLimiterKey(ipHash, namespace);

        if (env?.LIMITER) {
          const limiterStub = env.LIMITER.get(env.LIMITER.idFromName(limiterKey));
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

        // Check if client requested resuming an existing active code (e.g. page refresh)
        const resumeCode = url.searchParams.get('resumeCode');
        let selectedCode = null;
        if (resumeCode && /^\d{6}$/.test(resumeCode) && env?.OTP_ROOM) {
          const otpKey = getOtpKey(resumeCode, namespace);
          const otpStub = env.OTP_ROOM.get(env.OTP_ROOM.idFromName(otpKey));
          const checkRes = await otpStub.fetch(new Request('http://internal/resume-check'));
          const checkData = await checkRes.json().catch(() => ({ canResume: false }));
          if (checkData.canResume) {
            selectedCode = resumeCode;
          }
        }

        // Draw unique 6-digit code with up to 5 tries (TRD 4.1) if not resuming
        if (!selectedCode) {
          for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = generate6DigitCode();
            if (!env?.OTP_ROOM) {
              selectedCode = candidate;
              break;
            }

            const otpKey = getOtpKey(candidate, namespace);
            const otpStub = env.OTP_ROOM.get(env.OTP_ROOM.idFromName(otpKey));
            const checkRes = await otpStub.fetch(new Request('http://internal/claim-check'));
            const checkData = await checkRes.json().catch(() => ({ available: false }));

            if (checkData.available) {
              selectedCode = candidate;
              break;
            }
          }
        }

        if (!selectedCode) {
          return Response.json({ error: 'Failed to allocate unique code. Please retry.' }, { status: 503 });
        }

        // Forward to OtpRoom DO
        const targetUrl = new URL(request.url);
        targetUrl.searchParams.set('code', selectedCode);
        targetUrl.searchParams.set('workerNamespace', namespace);

        const otpKey = getOtpKey(selectedCode, namespace);
        const otpRoomStub = env.OTP_ROOM.get(env.OTP_ROOM.idFromName(otpKey));
        return otpRoomStub.fetch(new Request(targetUrl.toString(), request));
      }

      // 3. Sender WebSocket connection (creates or reclaims session)
      case '/ws/session': {
        if (request.headers.get('Upgrade') !== 'websocket') {
          return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        const namespace = getWorkerNamespace(request, url);
        const sessionIdParam = url.searchParams.get('sessionId');
        const senderToken = url.searchParams.get('senderToken');
        const isReconnect = Boolean(sessionIdParam && senderToken);

        // Rate check only on new sessions
        if (!isReconnect && env?.LIMITER) {
          const ip = getClientIp(request);
          const ipHash = await hashAddress(ip);
          const limiterKey = getLimiterKey(ipHash, namespace);
          const limiterStub = env.LIMITER.get(env.LIMITER.idFromName(limiterKey));
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
        targetUrl.searchParams.set('workerNamespace', namespace);

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
        return new Response('OnShare Signaling Service', { status: 200 });
    }
  }
};
