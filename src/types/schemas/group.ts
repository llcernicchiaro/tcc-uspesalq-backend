import { z } from "zod";

export const groupInputSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(["open", "closed"]),
  imageUrl: z.string().url().optional(),
});

export const groupUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  // 'type' não entra aqui porque não pode ser alterado
});

export const groupSchema = groupInputSchema.extend({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  deletedAt: z.string().datetime().optional(),
  isActive: z.number().default(1), // 1 = ativo, 0 = inativo
});

export type GroupInput = z.infer<typeof groupInputSchema>;
export type GroupUpdate = z.infer<typeof groupUpdateSchema>;
export type Group = z.infer<typeof groupSchema>;
