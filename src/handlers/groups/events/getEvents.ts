import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../../utils/createHandler.ts";
import { dynamoDB } from "../../../utils/dynamodb.ts";

import type { APIGatewayEventWithUser } from "@/types/api-gateway.js";

export const handler = createHandler(async (event: APIGatewayEventWithUser) => {
  const groupId = event.pathParameters?.groupId;
  if (!groupId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing groupId" }),
    };
  }

  // 1) Verifica existência e estado do grupo
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

  // 2) Busca todos os eventos daquele grupo
  const { Items: items } = await dynamoDB.send(
    new QueryCommand({
      TableName: "EventsTable",
      IndexName: "GroupIndex",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": groupId,
      },
    })
  );

  const events = items ?? [];

  // 3) Separa em futuros e passados
  const now = new Date().toISOString();
  const upcoming = [] as typeof events;
  const past = [] as typeof events;

  for (const ev of events) {
    if (ev.date >= now) upcoming.push(ev);
    else past.push(ev);
  }

  // 4) Retorna
  return {
    statusCode: 200,
    body: JSON.stringify({ upcoming, past }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});
