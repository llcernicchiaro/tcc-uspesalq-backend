import { BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../utils/createHandler.ts";
import { dynamoDB } from "../../utils/dynamodb.ts";

export const handler = createHandler(async (event) => {
  const userId = event.requestContext.authorizer?.claims?.sub;

  // 1. Buscar as inscrições do usuário
  const registrationResult = await dynamoDB.send(
    new QueryCommand({
      TableName: "EventRegistrationsTable",
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": userId,
      },
    })
  );

  const eventIds = registrationResult.Items?.map((item) => item.eventId) || [];

  if (eventIds.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ upcoming: [], past: [] }),
    };
  }

  // 2. Buscar os eventos
  const eventsResult = await dynamoDB.send(
    new BatchGetCommand({
      RequestItems: {
        EventsTable: {
          Keys: eventIds.map((id) => ({ id })),
        },
      },
    })
  );

  const events = (eventsResult.Responses?.EventsTable || []).filter(
    (event) => !event.deletedAt
  );

  if (events.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ upcoming: [], past: [] }),
    };
  }

  // 3. Buscar os grupos dos eventos
  const groupIds = [...new Set(events.map((event) => event.groupId))];

  const groupsResult = await dynamoDB.send(
    new BatchGetCommand({
      RequestItems: {
        GroupsTable: {
          Keys: groupIds.map((id) => ({ id })),
        },
      },
    })
  );

  const groups = groupsResult.Responses?.GroupsTable || [];

  const groupsMap = new Map(groups.map((group) => [group.id, group.name]));

  // 4. Enriquecer eventos com nome do grupo
  type CustomEvent = (typeof events)[0] & { groupName: string | null };
  const enrichedEvents: CustomEvent[] = events.map((event) => ({
    ...event,
    groupName: groupsMap.get(event.groupId) || null,
  }));

  // 5. Separar entre eventos futuros e passados
  const now = new Date().toISOString();
  const upcoming = [] as typeof enrichedEvents;
  const past = [] as typeof enrichedEvents;

  for (const event of enrichedEvents) {
    if (event.date >= now) upcoming.push(event);
    else past.push(event);
  }

  // 6. Ordenar
  upcoming.sort((a, b) => a.date.localeCompare(b.date)); // futuros: mais próximos primeiro
  past.sort((a, b) => b.date.localeCompare(a.date)); // passados: mais recentes primeiro

  // 7. Retornar
  return {
    statusCode: 200,
    body: JSON.stringify({ upcoming, past }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});
