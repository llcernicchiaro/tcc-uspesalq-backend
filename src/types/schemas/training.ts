import { z } from "zod";

export const trainingInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  date: z.string().datetime(),
});

export const trainingSchema = trainingInputSchema.extend({
  id: z.string(),
  groupId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type TrainingInput = z.infer<typeof trainingInputSchema>;
export type Training = z.infer<typeof trainingSchema>;
