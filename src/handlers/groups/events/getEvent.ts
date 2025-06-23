import {
  GetCommand,
  QueryCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../../utils/createHandler.ts";
import { dynamoDB } from "../../../utils/dynamodb.ts";

import type { APIGatewayEventWithUser } from "@/types/api-gateway.js";

export const handler = createHandler(async (event: APIGatewayEventWithUser) => {
  const eventId = event.pathParameters?.eventId;
  const userId = event.requestContext.authorizer?.claims?.sub;

  if (!eventId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing eventId" }),
    };
  }

  // Busca o evento
  const { Item: eventItem } = await dynamoDB.send(
    new GetCommand({
      TableName: "EventsTable",
      Key: { id: eventId },
    })
  );

  if (!eventItem || eventItem.deletedAt) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Event not found" }),
    };
  }

  // Busca inscrições
  const { Items: registrations = [] } = await dynamoDB.send(
    new QueryCommand({
      TableName: "EventRegistrationsTable",
      IndexName: "EventIdIndex",
      KeyConditionExpression: "eventId = :eventId",
      ExpressionAttributeValues: {
        ":eventId": eventId,
      },
    })
  );

  const userIds = registrations.map((r) => r.userId);

  // Busca dados dos usuários
  let usersMap: Record<string, { name: string; picture: string }> = {};
  if (userIds.length > 0) {
    const usersResult = await dynamoDB.send(
      new BatchGetCommand({
        RequestItems: {
          UsersTable: {
            Keys: userIds.map((id) => ({ id })),
          },
        },
      })
    );

    const users = usersResult.Responses?.UsersTable || [];
    usersMap = users.reduce((acc, user) => {
      acc[user.id] = {
        name: user.name,
        picture: user.picture,
      };
      return acc;
    }, {} as Record<string, { name: string; picture: string }>);
  }

  // Mapeia inscritos
  const mappedRegistrations = registrations.map((reg) => ({
    userId: reg.userId,
    name: usersMap[reg.userId]?.name || null,
    picture: usersMap[reg.userId]?.picture || null,
    registeredAt: reg.createdAt,
  }));

  // Verifica se o usuário atual está inscrito
  const isRegistered = registrations.some((r) => r.userId === userId);

  return {
    statusCode: 200,
    body: JSON.stringify({
      ...eventItem,
      isRegistered,
      registrationsCount: registrations.length,
      registrations: mappedRegistrations,
    }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});
