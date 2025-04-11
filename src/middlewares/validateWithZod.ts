import type { APIGatewayEvent } from "aws-lambda";
import type { MiddlewareObj } from "@middy/core";
import { ZodSchema } from "zod";

export const validateWithZod = (
  schema: ZodSchema
): MiddlewareObj<APIGatewayEvent> => {
  return {
    before: async (request) => {
      const parsed = schema.safeParse(request.event.body);

      if (!parsed.success) {
        throw new Error(
          `Validation error: ${parsed.error.issues
            .map((i) => i.message)
            .join(", ")}`
        );
      }

      request.event.body = parsed.data;
    },
  };
};
