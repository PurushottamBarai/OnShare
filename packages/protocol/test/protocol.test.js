import { describe, it, expect } from 'vitest';
import {
  MAX_MESSAGE_SIZE,
  ERROR_CODES,
  createMessage,
  serializeMessage,
  parseAndValidateMessage,
} from '../src/index.js';

describe('Shared Protocol Package', () => {
  it('creates and serializes message envelopes correctly', () => {
    const msg = createMessage('receiver.create', {});
    expect(msg.v).toBe(1);
    expect(msg.type).toBe('receiver.create');

    const raw = serializeMessage('receiver.create', {});
    const parsed = JSON.parse(raw);
    expect(parsed.v).toBe(1);
    expect(parsed.type).toBe('receiver.create');
    expect(parsed.id).toMatch(/^msg_/);
    expect(parsed.payload).toEqual({});
  });

  it('validates receiver.created payload', () => {
    const msg = {
      v: 1,
      type: 'receiver.created',
      id: 'test-1',
      payload: {
        code: '123456',
        expiresAt: 1700000000000,
      },
    };
    const validated = parseAndValidateMessage(msg);
    expect(validated.payload.code).toBe('123456');
  });

  it('validates signal messages with to and payload', () => {
    const msg = {
      v: 1,
      type: 'signal.offer',
      id: 'test-2',
      payload: {
        to: 'peer-abc',
        payload: { sdp: 'v=0...' },
      },
    };
    const validated = parseAndValidateMessage(msg);
    expect(validated.payload.to).toBe('peer-abc');
  });

  it('rejects payloads that do not match schema', () => {
    const invalid = {
      v: 1,
      type: 'receiver.created',
      id: 'test-3',
      payload: {
        code: '123', // requires 6 digits
        expiresAt: 1700000000000,
      },
    };
    expect(() => parseAndValidateMessage(invalid)).toThrow();
  });

  it('rejects unknown message types', () => {
    const invalid = {
      v: 1,
      type: 'unknown.type',
      id: 'test-4',
      payload: {},
    };
    expect(() => parseAndValidateMessage(invalid)).toThrow(/Unknown message type/);
  });

  it('rejects messages larger than 16 KB', () => {
    const largePayload = 'a'.repeat(MAX_MESSAGE_SIZE + 10);
    expect(() => parseAndValidateMessage(largePayload)).toThrow(/maximum size/);
  });

  it('exports standard error codes', () => {
    expect(ERROR_CODES.OTP_INVALID).toBe('OTP_INVALID');
    expect(ERROR_CODES.OTP_EXPIRED).toBe('OTP_EXPIRED');
    expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(ERROR_CODES.SESSION_FULL).toBe('SESSION_FULL');
  });
});
