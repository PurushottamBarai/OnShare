import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';

describe('Signaling Worker Scaffold', () => {
  it('returns health check status ok', async () => {
    const request = new Request('https://signaling.local/health');
    const response = await worker.fetch(request, {}, {});
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('shareport-signaling');
  });

  it('handles default root path', async () => {
    const request = new Request('https://signaling.local/');
    const response = await worker.fetch(request, {}, {});
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('SharePort Signaling Service');
  });
});
