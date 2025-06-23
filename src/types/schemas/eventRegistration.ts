import { z } from "zod";

export const eventRegistrationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type EventRegistration = z.infer<typeof eventRegistrationSchema>;
