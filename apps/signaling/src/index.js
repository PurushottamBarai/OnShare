/**
 * SharePort Signaling Service (Cloudflare Workers + Durable Objects)
 * Plain JavaScript (ES2022+) per TRD section 3 & 5.1
 */

export class OtpRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(_request) {
    return new Response('OtpRoom scaffold active', { status: 200 });
  }
}

export class Session {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(_request) {
    return new Response('Session scaffold active', { status: 200 });
  }
}

export class Limiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(_request) {
    return new Response('Limiter scaffold active', { status: 200 });
  }
}

export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'shareport-signaling' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('SharePort Signaling Service Scaffold', { status: 200 });
  }
};
