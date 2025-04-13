import { z } from 'zod'

export const eventInputSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  date: z.string().datetime(),
  location: z.string().optional(),
})

export const eventSchema = eventInputSchema.extend({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
})

export type EventInput = z.infer<typeof eventInputSchema>
export type Event = z.infer<typeof eventSchema>
