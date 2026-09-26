import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { WebSocketServer, WebSocket } from 'ws';
import worker, { OtpRoom, Session, Limiter } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../../web/dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

class SafeMessageEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.data = init.data;
  }
}
const MessageEventImpl = typeof MessageEvent !== 'undefined' ? MessageEvent : SafeMessageEvent;

class SafeCloseEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.code = init.code || 1000;
    this.reason = init.reason || '';
  }
}
const CloseEventImpl = typeof CloseEvent !== 'undefined' ? CloseEvent : SafeCloseEvent;

const socketStorage = new AsyncLocalStorage();

/**
 * Node.js Standalone Signaling Server (TRD Section 5.2 fallback)
 * Runs the exact same Durable Object logic in-memory with the ws library.
 */
class InMemoryDONamespace {
  constructor(ClassConstructor, env) {
    this.ClassConstructor = ClassConstructor;
    this.instances = new Map();
    this.env = env;
  }

  idFromName(name) {
    return { name, toString: () => name };
  }

  clear(namespace) {
    if (namespace && namespace !== 'default') {
      for (const key of this.instances.keys()) {
        if (key.startsWith(`${namespace}:`)) {
          this.instances.delete(key);
        }
      }
    } else {
      this.instances.clear();
    }
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

class InternalSocket extends EventTarget {
  constructor() {
    super();
    this.readyState = 1; // OPEN
    this.peer = null;
    this.messageQueue = [];
    this.hasMessageListener = false;
  }

  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    if (type === 'message') {
      this.hasMessageListener = true;
      while (this.messageQueue.length > 0) {
        const event = this.messageQueue.shift();
        super.dispatchEvent(event);
      }
    }
  }

  dispatchMessage(event) {
    if (!this.hasMessageListener) {
      this.messageQueue.push(event);
    } else {
      this.dispatchEvent(event);
    }
  }

  send(data) {
    if (!this.peer) return;
    if (this.peer.readyState === WebSocket.OPEN) {
      try {
        this.peer.send(data);
      } catch {
        // ignore send error on closing socket
      }
    } else if (this.peer.readyState === WebSocket.CONNECTING) {
      this.peer.once('open', () => {
        try {
          this.peer.send(data);
        } catch {
          // ignore
        }
      });
    }
  }

  close(code = 1000, reason = '') {
    this.readyState = 3;
    if (this.peer && this.peer.readyState === WebSocket.OPEN) {
      try {
        this.peer.close(code, reason);
      } catch {
        // ignore
      }
    }
    this.dispatchEvent(new CloseEventImpl('close', { code, reason }));
  }
}

export function createServer(port = 8787) {
  const env = {
    TURN_SECRET: process.env.TURN_SECRET || 'onshare-dev-turn-secret',
    TURN_DOMAIN: process.env.TURN_DOMAIN || 'turn.onshare.net',
    EXPRESSTURN_USERNAME: process.env.EXPRESSTURN_USERNAME,
    EXPRESSTURN_PASSWORD: process.env.EXPRESSTURN_PASSWORD,
    METERED_TURN_DOMAIN: process.env.METERED_TURN_DOMAIN,
    METERED_TURN_USERNAME: process.env.METERED_TURN_USERNAME,
    METERED_TURN_PASSWORD: process.env.METERED_TURN_PASSWORD,
    createWebSocketPair: () => {
      const store = socketStorage.getStore();
      if (store?.serverSide) {
        return [store.serverSide, store.serverSide];
      }
      throw new Error('createWebSocketPair called outside of socketStorage context');
    },
  };

  env.OTP_ROOM = new InMemoryDONamespace(OtpRoom, env);
  env.SESSION = new InMemoryDONamespace(Session, env);
  env.LIMITER = new InMemoryDONamespace(Limiter, env);

  const server = http.createServer(async (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = new URL(req.url, `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    if (url.pathname === '/test/shutdown') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      try {
        wss.close();
      } catch {
        // Ignore close error if already terminated
      }
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
      return;
    }

    // 1. API/worker endpoints
    const isWorkerEndpoint = url.pathname === '/health' || url.pathname.startsWith('/test/');

    // 2. Static file serving fallback for Single-Service deployment (Render, Docker, etc.)
    if (!isWorkerEndpoint && fs.existsSync(DIST_DIR) && (req.method === 'GET' || req.method === 'HEAD')) {
      const sanitizedPath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(DIST_DIR, sanitizedPath);

      // Prevent directory traversal
      if (filePath.startsWith(DIST_DIR)) {
        try {
          const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
          if (stat && stat.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            res.statusCode = 200;
            res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
            if (ext !== '.html') {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              res.setHeader('Cache-Control', 'no-cache');
            }
            return res.end(fs.readFileSync(filePath));
          }

          // SPA fallback to index.html for client routes (e.g. /send, /receive, /privacy)
          const indexPath = path.join(DIST_DIR, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            return res.end(fs.readFileSync(indexPath));
          }
        } catch {
          // Fall through to worker handler
        }
      }
    }

    const workerReq = new Request(url.toString(), {
      method: req.method,
      headers,
    });

    try {
      const workerRes = await worker.fetch(workerReq, env);
      res.statusCode = workerRes.status;
      workerRes.headers.forEach((v, k) => {
        res.setHeader(k, v);
      });
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      const body = await workerRes.arrayBuffer();
      res.end(Buffer.from(body));
    } catch (err) {
      res.statusCode = 500;
      res.end(err.message || 'Internal Server Error');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || `localhost:${port}`;
      const url = new URL(req.url, `${protocol}://${host}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }
      headers.set('Upgrade', 'websocket');

      const serverSide = new InternalSocket();
      serverSide.peer = ws;

      // When node ws receives message, forward to internal server socket
      ws.on('message', (data) => {
        const text = typeof data === 'string' ? data : data.toString();
        serverSide.dispatchMessage(new MessageEventImpl('message', { data: text }));
      });

      ws.on('close', (code, reason) => {
        serverSide.readyState = 3;
        serverSide.dispatchEvent(new CloseEventImpl('close', { code, reason: reason?.toString() }));
      });

      ws.on('error', () => {
        serverSide.readyState = 3;
        serverSide.dispatchEvent(new CloseEventImpl('close', { code: 1006, reason: 'Abnormal Closure' }));
      });

      const workerReq = new Request(url.toString(), {
        method: 'GET',
        headers,
      });

      // Run worker.fetch within socketStorage context for this specific connection
      socketStorage.run({ serverSide }, async () => {
        try {
          await worker.fetch(workerReq, env);
        } catch (err) {
          ws.close(1011, err.message);
        }
      });
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      globalThis.__signalingServer = server;
      resolve(server);
    });
  });
}

// Auto-run when executed directly
if (process.argv[1]?.endsWith('server.js')) {
  const PORT = process.env.PORT || 8787;
  createServer(PORT).then(() => {
    console.info(`OnShare standalone signaling service running on http://localhost:${PORT}`);
  });
}
