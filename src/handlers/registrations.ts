import type { APIGatewayProxyResult } from "aws-lambda";

import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";

import { addMetadata } from "../utils/addMetadata.ts";
import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";
import { validateWithZod } from "../middlewares/validateWithZod.ts";

const registrationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  workoutId: z.string().uuid(),
  time: z.number().positive(),
  registeredAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid date format",
  }),
});

type RegistrationInput = z.infer<typeof registrationSchema>;

export const createRegistration = createHandler(
  async (
    event: APIGatewayProxyResult & { body: RegistrationInput }
  ): Promise<APIGatewayProxyResult> => {
    const body = event.body; // segura aqui, por causa do jsonBodyParser

    const enrichedData = addMetadata(body);

    await dynamoDB.send(
      new PutCommand({
        TableName: "RegistrationsTable",
        Item: enrichedData,
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Registration created" }),
    };
  },
  [validateWithZod(registrationSchema)]
);

export const listRegistrations = createHandler(async () => {
  const result = await dynamoDB.send(
    new ScanCommand({ TableName: "RegistrationsTable" })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
});
