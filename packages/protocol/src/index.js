import { z } from 'zod';

/**
 * Shared protocol envelope schema (TRD section 5.3)
 * Envelope: { v, type, id, payload }
 */
export const EnvelopeSchema = z.object({
  v: z.number().int().default(1),
  type: z.string().min(1),
  id: z.string().min(1),
  payload: z.record(z.unknown()).default({})
});

export const ReceiverCreateSchema = z.object({
  type: z.literal('receiver.create')
});

export const SessionCreateSchema = z.object({
  type: z.literal('session.create'),
  validity: z.number().optional(),
  mode: z.enum(['files', 'text']).default('files')
});
