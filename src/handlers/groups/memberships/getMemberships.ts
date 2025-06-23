import {
  BatchGetCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

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

  // Buscar informações do grupo para saber se é fechado
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

  // Consulta todas as memberships desse grupo
  const { Items: memberships } = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "GroupIdIndex",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": groupId,
      },
    })
  );

  if (!memberships || memberships.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        active: [],
        pending: [],
      }),
    };
  }

  const userIds = memberships.map((m) => m.userId);

  // Busca os dados completos dos usuários
  const usersData = await dynamoDB.send(
    new BatchGetCommand({
      RequestItems: {
        UsersTable: {
          Keys: userIds.map((id) => ({ id })),
        },
      },
    })
  );

  const usersMap = new Map(
    usersData.Responses?.UsersTable.map((u) => [u.id, u])
  );

  const active = [];
  const pending = [];

  for (const m of memberships) {
    const user = usersMap.get(m.userId);
    if (!user) continue;
    const member = {
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      role: m.role,
      memberSince: m.createdAt,
    };

    if (m.status === "pending") {
      pending.push(member);
    } else {
      active.push(member);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      active,
      pending,
      isClosed: group.type === "closed",
    }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});
