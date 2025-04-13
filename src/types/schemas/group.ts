import { z } from 'zod'

export const groupInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export const groupSchema = groupInputSchema.extend({
  id: z.string(),
  createdBy: z.string(), // ID do usuário criador do grupo
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
})

export type GroupInput = z.infer<typeof groupInputSchema>
export type Group = z.infer<typeof groupSchema>
