import { z } from "zod";

export const eventRegistrationInputSchema = z.object({
  eventId: z.string(),
  userId: z.string(),
  performance: z.number().optional(), // se quiser já registrar um tempo ou pontuação
});

export const eventRegistrationSchema = eventRegistrationInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
