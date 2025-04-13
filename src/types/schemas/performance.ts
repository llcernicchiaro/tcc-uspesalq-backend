import { z } from 'zod'

export const performanceInputSchema = z.object({
  trainingId: z.string(),
  timeInSeconds: z.number().positive(),
  distanceInMeters: z.number().positive(),
})

export const performanceSchema = performanceInputSchema.extend({
  id: z.string(),
  userId: z.string(),
  groupId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
})

export type PerformanceInput = z.infer<typeof performanceInputSchema>
export type Performance = z.infer<typeof performanceSchema>
