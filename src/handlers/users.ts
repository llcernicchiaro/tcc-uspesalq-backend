import type { APIGatewayEvent } from "aws-lambda";

import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";

export const createUser = createHandler(async (event: APIGatewayEvent) => {
  const { id, name, email, role } = JSON.parse(event.body || "{}");

  await dynamoDB.send(
    new PutCommand({
      TableName: "UsersTable",
      Item: { id, name, email, role },
    })
  );

  return {
    statusCode: 201,
    body: JSON.stringify({ message: "User created" }),
  };
});

export const listUsers = createHandler(async () => {
  const result = await dynamoDB.send(
    new ScanCommand({ TableName: "UsersTable" })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
});
