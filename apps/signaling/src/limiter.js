/**
 * Limiter Durable Object (TRD Section 4.2 & 5.1)
 * Tracks rate limits and failed attempts per hashed network address
 */

export class Limiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // In-memory sliding windows
    this.failedAttempts = [];
    this.createdCodes = [];
    this.createdSessions = [];
    this.lockedUntil = 0;
    this.lockoutCount = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();

    // Clean up expired entries (10 min window)
    const tenMinAgo = now - 10 * 60 * 1000;
    this.failedAttempts = this.failedAttempts.filter(t => t > tenMinAgo);
    this.createdCodes = this.createdCodes.filter(t => t > tenMinAgo);
    this.createdSessions = this.createdSessions.filter(t => t > tenMinAgo);

    if (url.pathname === '/check') {
      const { action } = await request.json().catch(() => ({}));

      // Check active lockout
      if (this.lockedUntil > now) {
        const retryAfter = Math.ceil((this.lockedUntil - now) / 1000);
        return Response.json({
          allowed: false,
          error: 'RATE_LIMITED',
          retryAfter,
        }, { status: 429 });
      }

      // Check failed attempts (max 200 per 10 min)
      if (this.failedAttempts.length >= 200) {
        this.applyLockout(now);
        const retryAfter = Math.ceil((this.lockedUntil - now) / 1000);
        return Response.json({
          allowed: false,
          error: 'RATE_LIMITED',
          retryAfter,
        }, { status: 429 });
      }

      // Check creation quotas (max 3000 per 10 min)
      if (action === 'create_code' && this.createdCodes.length >= 3000) {
        return Response.json({
          allowed: false,
          error: 'RATE_LIMITED',
          message: 'Code creation rate limit exceeded',
          retryAfter: 60,
        }, { status: 429 });
      }

      if (action === 'create_session' && this.createdSessions.length >= 3000) {
        return Response.json({
          allowed: false,
          error: 'RATE_LIMITED',
          message: 'Session creation rate limit exceeded',
          retryAfter: 60,
        }, { status: 429 });
      }

      return Response.json({ allowed: true });
    }

    if (url.pathname === '/record') {
      const { type } = await request.json().catch(() => ({}));
      if (type === 'failure') {
        this.failedAttempts.push(now);
        if (this.failedAttempts.length >= 200) {
          this.applyLockout(now);
        }
      } else if (type === 'create_code') {
        this.createdCodes.push(now);
      } else if (type === 'create_session') {
        this.createdSessions.push(now);
      }
      return Response.json({ success: true, count: this.failedAttempts.length });
    }

    if (url.pathname === '/reset') {
      this.failedAttempts = [];
      this.createdCodes = [];
      this.createdSessions = [];
      this.lockedUntil = 0;
      this.lockoutCount = 0;
      return Response.json({ success: true });
    }

    return new Response('Not Found', { status: 404 });
  }

  applyLockout(now) {
    this.lockoutCount++;
    // Escalating lockout: 1 min, 5 min, 15 min...
    const durations = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
    const duration = durations[Math.min(this.lockoutCount - 1, durations.length - 1)];
    this.lockedUntil = now + duration;
  }
}
