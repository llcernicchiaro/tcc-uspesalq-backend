import type { MiddlewareObj } from "@middy/core";
import { ZodSchema } from "zod";
import type { APIGatewayEventWithUserAndBody } from "@/types/api-gateway.js";

export const validateWithZod = <T>(schema: ZodSchema<T>): MiddlewareObj => {
  return {
    before: async (request) => {
      const event = request.event as APIGatewayEventWithUserAndBody<T>;
      const parsed = schema.safeParse(event.body);

      if (!parsed.success) {
        const formattedErrors = parsed.error.errors.map((issue) => {
          return `${issue.path.join(".")}: ${issue.message}`;
        });

        throw new Error(`Validation failed: ${formattedErrors.join(" | ")}`);
      }
    },
  };
};
