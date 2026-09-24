import { describe, it, expect } from 'vitest';
import { encodeFrame, decodeFrame, FRAME_HEADER_SIZE, FLAG_FINAL_FRAME } from '../src/transfer/frame.js';

describe('Binary Data Frames (TRD 7.3)', () => {
  it('encodes and decodes a normal frame', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const frame = encodeFrame(data, 1024, false);

    expect(frame.byteLength).toBe(FRAME_HEADER_SIZE + data.byteLength);

    const decoded = decodeFrame(frame);
    expect(decoded.isFinal).toBe(false);
    expect(decoded.flags).toBe(0);
    expect(decoded.offset).toBe(1024);
    expect(Array.from(decoded.payload)).toEqual([1, 2, 3, 4, 5]);
  });

  it('encodes and decodes a final frame with flag', () => {
    const data = new Uint8Array([99, 100]);
    const frame = encodeFrame(data, 2048, true);

    const decoded = decodeFrame(frame);
    expect(decoded.isFinal).toBe(true);
    expect(decoded.flags & FLAG_FINAL_FRAME).toBe(FLAG_FINAL_FRAME);
    expect(decoded.offset).toBe(2048);
    expect(Array.from(decoded.payload)).toEqual([99, 100]);
  });

  it('handles empty payload (zero-byte file or final zero-byte chunk)', () => {
    const frame = encodeFrame(new Uint8Array(0), 0, true);
    expect(frame.byteLength).toBe(FRAME_HEADER_SIZE);

    const decoded = decodeFrame(frame);
    expect(decoded.isFinal).toBe(true);
    expect(decoded.offset).toBe(0);
    expect(decoded.payload.byteLength).toBe(0);
  });

  it('throws on malformed frame less than 12 bytes', () => {
    expect(() => decodeFrame(new Uint8Array(5))).toThrow(/Frame too small/);
  });
});
