import type { MiddlewareObj } from "@middy/core";
import { ZodSchema } from "zod";
import type { APIGatewayEventWithUserAndBody } from "@/types/api-gateway.js";

export const validateWithZod = <T>(
  schema: ZodSchema<T>
): MiddlewareObj => {
  return {
    before: async (request) => {
      const event = request.event as APIGatewayEventWithUserAndBody<T>;
      const parsed = schema.safeParse(event.body);

      console.log("Parsed body:", parsed);
      console.log("Schema:", schema);
      console.log("Event body:", event.body);

      if (!parsed.success) {
        throw new Error(
          `Validation error: ${parsed.error.issues
            .map((i) => i.message)
            .join(", ")}`
        );
      }
    },
  };
};
