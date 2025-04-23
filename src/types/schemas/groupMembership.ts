import { z } from "zod";

export const groupMembershipSchema = z.object({
  id: z.string(), // UUID único da relação
  groupId: z.string(), // ID do grupo
  userId: z.string(), // ID do usuário
  role: z.enum(["admin", "participant"]), // Papel do usuário no grupo
  status: z.enum(["active", "pending", "inactive"]), // Status da relação
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type GroupMembership = z.infer<typeof groupMembershipSchema>;
