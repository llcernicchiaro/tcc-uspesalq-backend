import type { APIGatewayEventWithUserAndBody } from "../types/api-gateway.d.ts";

import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";
import { addMetadata } from "../utils/addMetadata.ts";
import { validateWithZod } from "../middlewares/validateWithZod.ts";
import {
  performanceSchema,
  type PerformanceInput,
} from "../types/schemas/performance.ts";

export const createPerformance = createHandler(
  async (event: APIGatewayEventWithUserAndBody<PerformanceInput>) => {
    const { trainingId, timeInSeconds, distanceInMeters } = event.body;

    const item = addMetadata({ trainingId, timeInSeconds, distanceInMeters });

    await dynamoDB.send(
      new PutCommand({ TableName: "PerformancesTable", Item: item })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Performance created",
        performance: item,
      }),
    };
  },
  [validateWithZod(performanceSchema)]
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
