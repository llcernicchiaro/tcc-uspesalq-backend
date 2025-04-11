import { randomUUID } from "node:crypto";

interface BaseItem {
  [key: string]: unknown;
}

export const addMetadata = <T extends BaseItem>(data: T) => {
  const now = new Date().toISOString();

  return {
    ...data,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
};
