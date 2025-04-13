import type { APIGatewayEventWithUserAndBody } from "../types/api-gateway.d.ts";

import { PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";
import { addMetadata } from "../utils/addMetadata.ts";

import { validateWithZod } from "../middlewares/validateWithZod.ts";

import {
  trainingInputSchema,
  type TrainingInput,
} from "../types/schemas/training.ts";

export const createTraining = createHandler(
  async (event: APIGatewayEventWithUserAndBody<TrainingInput>) => {
    const { name, date } = event.body;

    const item = addMetadata({ name, date });

    await dynamoDB.send(
      new PutCommand({ TableName: "TrainingsTable", Item: item })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Training created", training: item }),
    };
  },
  [validateWithZod(trainingInputSchema)]
);

export const listTrainings = createHandler(async () => {
  const result = await dynamoDB.send(
    new ScanCommand({ TableName: "TrainingsTable" })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
});

export const updateTraining = createHandler(
  async (event: APIGatewayEventWithUserAndBody<TrainingInput>) => {
    const id = event.pathParameters?.id;
    const { name } = event.body;

    await dynamoDB.send(
      new UpdateCommand({
        TableName: "TrainingsTable",
        Key: { id },
        UpdateExpression:
          "SET #name = :name, #distance = :distance, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#name": "name",
          "#distance": "distance",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":name": name,
          // ":distance": distance,
          // ":updatedAt": updatedAt,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Workout updated" }),
    };
  }
);
