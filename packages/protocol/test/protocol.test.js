import { describe, it, expect } from 'vitest';
import { EnvelopeSchema } from '../src/index.js';

describe('Protocol Envelope Schema', () => {
  it('validates a valid message envelope', () => {
    const message = {
      v: 1,
      type: 'receiver.create',
      id: 'msg-123',
      payload: {}
    };

    const parsed = EnvelopeSchema.safeParse(message);
    expect(parsed.success).toBe(true);
  });

  it('rejects an envelope without required fields', () => {
    const invalid = { v: 1 };
    const parsed = EnvelopeSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
