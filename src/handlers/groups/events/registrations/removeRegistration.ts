// src/handlers/groups/events/registrations/deleteRegistration.ts
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { createHandler } from "../../../../utils/createHandler.ts";
import { dynamoDB } from "../../../../utils/dynamodb.ts";

import type { APIGatewayEventWithUser } from "@/types/api-gateway.js";

export const handler = createHandler(async (event: APIGatewayEventWithUser) => {
  const groupId = event.pathParameters?.groupId;
  const eventId = event.pathParameters?.eventId;
  const userId = event.requestContext.authorizer?.claims?.sub;

  if (!groupId || !eventId || !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing groupId, eventId or userId" }),
    };
  }

  // 1) Verifica se o grupo existe e está ativo
  const { Item: group } = await dynamoDB.send(
    new GetCommand({
      TableName: "GroupsTable",
      Key: { id: groupId },
    })
  );

  if (!group || group.deletedAt) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Group not found" }),
    };
  }

  // 2) Verifica se o evento existe e pertence ao grupo
  const { Item: ev } = await dynamoDB.send(
    new GetCommand({
      TableName: "EventsTable",
      Key: { id: eventId },
    })
  );
  if (!ev || ev.groupId !== groupId || ev.deletedAt) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Event not found in this group" }),
    };
  }

  // 3) Verifica se a inscrição existe
  const { Item: registration } = await dynamoDB.send(
    new GetCommand({
      TableName: "EventRegistrationsTable",
      Key: { userId, eventId },
    })
  );

  if (!registration) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Registration not found" }),
    };
  }

  // 4) Deleta a inscrição
  await dynamoDB.send(
    new DeleteCommand({
      TableName: "EventRegistrationsTable",
      Key: { userId, eventId },
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Registration cancelled successfully" }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});
