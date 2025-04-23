import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  picture: z.string().url(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type User = z.infer<typeof userSchema>;
