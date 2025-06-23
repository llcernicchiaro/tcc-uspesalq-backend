import { z } from "zod";

export const eventInputSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  date: z.string().datetime(),
  location: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const eventSchema = eventInputSchema.extend({
  id: z.string(),
  groupId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

// Novo: schema de atualização
export const eventUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  date: z.string().datetime().optional(),
  location: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export type EventInput = z.infer<typeof eventInputSchema>;
export type Event = z.infer<typeof eventSchema>;
export type EventUpdate = z.infer<typeof eventUpdateSchema>;
