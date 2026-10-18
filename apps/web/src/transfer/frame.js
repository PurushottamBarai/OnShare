export const FRAME_HEADER_SIZE = 12;
export const DEFAULT_CHUNK_SIZE = 64 * 1024;
export const FLAG_FINAL_FRAME = 0x01;

export function encodeFrame(payload, offset = 0, isFinal = false) {
  const payloadLength = payload ? payload.byteLength : 0;
  const frame = new Uint8Array(FRAME_HEADER_SIZE + payloadLength);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);

  const flags = isFinal ? FLAG_FINAL_FRAME : 0;
  view.setUint8(0, flags);

  view.setUint8(1, 0);
  view.setUint8(2, 0);
  view.setUint8(3, 0);

  view.setBigUint64(4, BigInt(offset), false);

  if (payload && payloadLength > 0) {
    frame.set(payload, FRAME_HEADER_SIZE);
  }

  return frame;
}

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
