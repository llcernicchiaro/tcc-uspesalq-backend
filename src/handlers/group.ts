import type { APIGatewayEventWithUserAndBody } from "../types/api-gateway.js";

import {
  QueryCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";
import { addMetadata } from "../utils/addMetadata.ts";

import { validateWithZod } from "../middlewares/validateWithZod.ts";

import { groupInputSchema, type GroupInput } from "../types/schemas/group.ts";

export async function getUserGroups(userId: string) {
  // 1. Buscar os groupIds da membership
  const membershipResult = await dynamoDB.send(
    new QueryCommand({
      TableName: "groupMembership",
      IndexName: "UserIdIndex", // ou remova se userId for a PK
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": { S: userId },
      },
    })
  );

  const groupIds = membershipResult.Items?.map((item) => item.groupId.S) || [];

  if (groupIds.length === 0) return [];

  // 2. Buscar os grupos com BatchGet
  const groups = await dynamoDB.send(
    new BatchGetCommand({
      RequestItems: {
        groups: {
          Keys: groupIds.map((id) => ({ groupId: { S: id } })),
        },
      },
    })
  );

  return groups;
}

export const listGroupsByUser = createHandler(async (event) => {
  const userId = event.requestContext.authorizer?.jwt?.claims?.sub;
  const groups = await getUserGroups(userId); // Substitua "userId" pelo ID do usuário real

  return {
    statusCode: 200,
    body: JSON.stringify(groups),
  };
});

export const createGroup = createHandler(
  async (event: APIGatewayEventWithUserAndBody<GroupInput>) => {
    const userId = event.requestContext.authorizer?.jwt?.claims?.sub;
    const group = addMetadata(event.body);

    await dynamoDB.send(
      new PutCommand({ TableName: "GroupsTable", Item: group })
    );

    // opcional: já insere o criador como admin no groupMembership
    await dynamoDB.send(
      new PutCommand({
        TableName: "GroupMembershipTable",
        Item: addMetadata({
          groupId: group.id,
          userId,
          role: "admin",
          status: "active",
        }),
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Group created", group }),
    };
  },
  [validateWithZod(groupInputSchema)]
);

export const listGroups = createHandler(async () => {
  const result = await dynamoDB.send(
    new ScanCommand({ TableName: "GroupsTable" })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
});

export const updateTraining = createHandler(
  async (event: APIGatewayEventWithUserAndBody<GroupInput>) => {
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
