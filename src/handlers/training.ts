import type { APIGatewayEvent } from "aws-lambda";

// import { z } from "zod";
import { PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";
// import { validateWithZod } from "../middlewares/validateWithZod.ts";

// const trainingSchema = z.object({
//   id: z.string(),
//   name: z.string(),
//   date: z.string(),
//   distance: z.number().positive(),
// });

export const createTraining = createHandler(async (event: APIGatewayEvent) => {
  const { id, name, date, distance } = JSON.parse(event.body || "{}");

  await dynamoDB.send(
    new PutCommand({
      TableName: "TrainingsTable",
      Item: { id, name, date, distance },
    })
  );

  return {
    statusCode: 201,
    body: JSON.stringify({ message: "Training created" }),
  };
});

export const listTrainings = createHandler(async () => {
  const result = await dynamoDB.send(
    new ScanCommand({ TableName: "TrainingsTable" })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
});

export const updateTraining = createHandler(async (event) => {
  const id = event.pathParameters?.id;
  const { name, distance, updatedAt } = JSON.parse(event.body || "{}");

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
        ":distance": distance,
        ":updatedAt": updatedAt,
      },
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Workout updated", updatedAt }),
  };
});
