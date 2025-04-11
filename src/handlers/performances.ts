import type { APIGatewayEvent } from "aws-lambda";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";

export const createPerformance = createHandler(
  async (event: APIGatewayEvent) => {
    const { id, userId, workoutId, time, registeredAt } = JSON.parse(
      event.body || "{}"
    );

    await dynamoDB.send(
      new PutCommand({
        TableName: "PerformancesTable",
        Item: { id, userId, workoutId, time, registeredAt },
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Performance created" }),
    };
  }
);

export const listPerformances = createHandler(async () => {
  const result = await dynamoDB.send(
    new ScanCommand({ TableName: "PerformancesTable" })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
});
