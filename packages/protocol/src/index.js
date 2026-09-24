import { z } from 'zod';

/**
 * Maximum message size in bytes (TRD section 5.3)
 */
export const MAX_MESSAGE_SIZE = 16 * 1024; // 16 KB

/**
 * Standard Error Codes (TRD section 5.3 & 12)
 */
export const ERROR_CODES = {
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  SESSION_FULL: 'SESSION_FULL',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  BAD_MESSAGE: 'BAD_MESSAGE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  PEER_UNREACHABLE: 'PEER_UNREACHABLE',
  TRANSFER_CANCELLED: 'TRANSFER_CANCELLED',
  BROWSER_UNSUPPORTED: 'BROWSER_UNSUPPORTED',
};

/**
 * IceServer schema
 */
export const IceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

/**
 * Base Message Envelope Schema
 * JSON over WebSocket: { v, type, id, payload }
 */
export const EnvelopeSchema = z.object({
  v: z.number().int().default(1),
  type: z.string().min(1),
  id: z.string().min(1),
  payload: z.record(z.any()).default({}),
});

/**
 * Individual message payload schemas
 */
export const ReceiverCreatePayloadSchema = z.object({});

export const ReceiverCreatedPayloadSchema = z.object({
  code: z.string().length(6),
  expiresAt: z.number(),
});

export const ReceiverRegeneratePayloadSchema = z.object({});

export const SessionCreatePayloadSchema = z.object({
  validity: z.number().optional(),
  mode: z.enum(['files', 'text']).default('files'),
});

export const SessionCreatedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  senderToken: z.string().min(1),
  iceServers: z.array(IceServerSchema),
});

export const SessionAddReceiverPayloadSchema = z.object({
  code: z.string().length(6),
});

export const SessionReceiverMatchedPayloadSchema = z.object({
  receiverId: z.string().min(1),
});

export const ReceiverMatchedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  joinToken: z.string().min(1),
  iceServers: z.array(IceServerSchema),
});

export const ReceiverJoinPayloadSchema = z.object({
  sessionId: z.string().min(1),
  joinToken: z.string().min(1),
});

export const SignalPayloadSchema = z.object({
  to: z.string().min(1),
  from: z.string().optional(),
  payload: z.any(),
}).passthrough();

export const SessionRemoveReceiverPayloadSchema = z.object({
  receiverId: z.string().min(1),
});

export const SessionEndPayloadSchema = z.object({}).optional();

export const PeerLeftPayloadSchema = z.object({
  peerId: z.string().optional(),
  reason: z.string().optional(),
});

export const SessionClosedPayloadSchema = z.object({
  reason: z.string(),
});

export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  retryAfter: z.number().optional(),
});

export const HeartbeatPayloadSchema = z.object({}).optional();

/**
 * Mapping of message types to payload schemas
 */
export const PAYLOAD_SCHEMAS = {
  'receiver.create': ReceiverCreatePayloadSchema,
  'receiver.created': ReceiverCreatedPayloadSchema,
  'receiver.regenerate': ReceiverRegeneratePayloadSchema,
  'session.create': SessionCreatePayloadSchema,
  'session.created': SessionCreatedPayloadSchema,
  'session.addReceiver': SessionAddReceiverPayloadSchema,
  'session.receiverMatched': SessionReceiverMatchedPayloadSchema,
  'receiver.matched': ReceiverMatchedPayloadSchema,
  'receiver.join': ReceiverJoinPayloadSchema,
  'signal.offer': SignalPayloadSchema,
  'signal.answer': SignalPayloadSchema,
  'signal.ice': SignalPayloadSchema,
  'session.removeReceiver': SessionRemoveReceiverPayloadSchema,
  'session.end': SessionEndPayloadSchema,
  'peer.left': PeerLeftPayloadSchema,
  'session.closed': SessionClosedPayloadSchema,
  'error': ErrorPayloadSchema,
  'ping': HeartbeatPayloadSchema,
  'pong': HeartbeatPayloadSchema,
};

/**
 * Helper to construct an envelope message
 */
let messageCounter = 0;
export function createMessage(type, payload = {}, id = null) {
  const msgId = id || `msg_${Date.now()}_${++messageCounter}`;
  return {
    v: 1,
    type,
    id: msgId,
    payload,
  };
}

/**
 * Helper to serialize a message to JSON string
 */
export function serializeMessage(type, payload = {}, id = null) {
  const msg = createMessage(type, payload, id);
  return JSON.stringify(msg);
}

/**
 * Helper to parse and validate incoming raw message string or JSON
 */
export function parseAndValidateMessage(raw) {
  if (typeof raw === 'string') {
    if (new TextEncoder().encode(raw).length > MAX_MESSAGE_SIZE) {
      throw new Error(`Message exceeds maximum size of ${MAX_MESSAGE_SIZE} bytes`);
    }
    raw = JSON.parse(raw);
  }

  const envelope = EnvelopeSchema.parse(raw);
  const schema = PAYLOAD_SCHEMAS[envelope.type];
  if (!schema) {
    throw new Error(`Unknown message type: ${envelope.type}`);
  }

  const validPayload = schema.parse(envelope.payload);
  return {
    ...envelope,
    payload: validPayload,
  };
}
