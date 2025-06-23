// src/handlers/groups/events/registrations/createRegistration.ts
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createHandler } from "../../../../utils/createHandler.ts";
import { dynamoDB } from "../../../../utils/dynamodb.ts";
import { addMetadata } from "../../../../utils/addMetadata.ts";

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

  // 1. Verifica se o grupo existe e está ativo
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

  // 2. Verifica se o evento existe e pertence ao grupo
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

  // 3. Verifica se o usuário já está inscrito
  const { Item: existing } = await dynamoDB.send(
    new GetCommand({
      TableName: "EventRegistrationsTable",
      Key: { userId, eventId },
    })
  );
  if (existing) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Already registered for this event" }),
    };
  }

  // 4. Cria a inscrição
  const registration = addMetadata({
    userId,
    eventId,
  });

  await dynamoDB.send(
    new PutCommand({
      TableName: "EventRegistrationsTable",
      Item: registration,
    })
  );

  return {
    statusCode: 201,
    body: JSON.stringify(registration),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});
