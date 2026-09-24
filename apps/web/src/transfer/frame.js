/**
 * Binary Data Frame Encoding & Decoding (TRD Section 7.3)
 *
 * Each frame has a 12-byte header followed by chunk payload:
 * - flags: 1 byte (bit 0: isFinal)
 * - reserved: 3 bytes (0x00, 0x00, 0x00)
 * - offset: 8 bytes (64-bit BigInt byte offset, big-endian)
 * - payload: variable (default 16 KiB chunks)
 */

export const FRAME_HEADER_SIZE = 12;
export const DEFAULT_CHUNK_SIZE = 16 * 1024; // 16 KiB
export const FLAG_FINAL_FRAME = 0x01;

/**
 * Encode a binary frame
 * @param {Uint8Array} payload - chunk bytes
 * @param {number|bigint} offset - byte offset in file/stream
 * @param {boolean} isFinal - whether this is the final frame
 * @returns {Uint8Array} complete frame with 12-byte header
 */
export function encodeFrame(payload, offset = 0, isFinal = false) {
  const payloadLength = payload ? payload.byteLength : 0;
  const frame = new Uint8Array(FRAME_HEADER_SIZE + payloadLength);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);

  // Flags: bit 0 indicates final frame
  const flags = isFinal ? FLAG_FINAL_FRAME : 0;
  view.setUint8(0, flags);

  // Reserved 3 bytes
  view.setUint8(1, 0);
  view.setUint8(2, 0);
  view.setUint8(3, 0);

  // 64-bit byte offset (big-endian)
  view.setBigUint64(4, BigInt(offset), false);

  // Payload
  if (payload && payloadLength > 0) {
    frame.set(payload, FRAME_HEADER_SIZE);
  }

  return frame;
}

/**
 * Decode a binary frame
 * @param {ArrayBuffer|Uint8Array} buffer - incoming raw frame data
 * @returns {{ flags: number, isFinal: boolean, offset: number, payload: Uint8Array }}
 */
export function decodeFrame(buffer) {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (uint8.byteLength < FRAME_HEADER_SIZE) {
    throw new Error(`Frame too small: ${uint8.byteLength} bytes (minimum ${FRAME_HEADER_SIZE})`);
  }

  const view = new DataView(uint8.buffer, uint8.byteOffset, FRAME_HEADER_SIZE);
  const flags = view.getUint8(0);
  const isFinal = (flags & FLAG_FINAL_FRAME) === FLAG_FINAL_FRAME;
  const offsetBigInt = view.getBigUint64(4, false);

  const payload = uint8.subarray(FRAME_HEADER_SIZE);

  return {
    flags,
    isFinal,
    offset: Number(offsetBigInt),
    payload,
  };
}
