// src/handlers/groups/events/deleteEvent.ts
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { createHandler } from "../../../utils/createHandler.ts";
import { dynamoDB } from "../../../utils/dynamodb.ts";
import type { APIGatewayEventWithUser } from "@/types/api-gateway.js";

export const handler = createHandler(async (event: APIGatewayEventWithUser) => {
  const { groupId, eventId } = event.pathParameters ?? {};
  const userId = event.requestContext.authorizer?.claims?.sub;

  if (!groupId || !eventId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing groupId or eventId" }),
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
      body: JSON.stringify({ message: "Grupo não encontrado" }),
    };
  }

  // 2) Verifica se quem chama é admin desse grupo
  const { Item: membership } = await dynamoDB.send(
    new GetCommand({
      TableName: "GroupMembershipTable",
      Key: { userId, groupId },
    })
  );
  if (
    !membership ||
    membership.status !== "active" ||
    membership.role !== "admin"
  ) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        message: "Apenas administradores podem deletar eventos",
      }),
    };
  }

  // 3) Verifica se o evento existe e pertence a esse grupo
  const { Item: eventItem } = await dynamoDB.send(
    new GetCommand({
      TableName: "EventsTable",
      Key: { id: eventId },
    })
  );
  if (!eventItem || eventItem.groupId !== groupId) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Evento não encontrado" }),
    };
  }

  // 4) DeleteCommand para remover o evento
  await dynamoDB.send(
    new DeleteCommand({
      TableName: "EventsTable",
      Key: { id: eventId },
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Evento removido com sucesso" }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});
