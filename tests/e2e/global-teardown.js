/**
 * Global Teardown for Playwright Test Suite
 * Closes the signaling server (server.close()) and awaits completion before reporting done.
 */
export default async function globalTeardown() {
  if (globalThis.__signalingServer) {
    await new Promise((resolve) => {
      globalThis.__signalingServer.close(() => resolve());
    });
  } else {
    try {
      const res = await fetch('http://127.0.0.1:8787/test/shutdown');
      await res.json().catch(() => ({}));
    } catch {
      // Server was already closed or offline
    }
  }
}
