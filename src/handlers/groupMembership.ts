import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  BatchGetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";

import { addMetadata } from "../utils/addMetadata.ts";
import type {
  APIGatewayEventWithUser,
  APIGatewayEventWithUserAndBody,
} from "@/types/api-gateway.js";

export const joinGroup = createHandler(async (event) => {
  const groupId = event.pathParameters?.groupId;
  const userId = event.requestContext.authorizer?.claims?.sub;

  if (!groupId || !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing groupId or userId" }),
    };
  }

  // Verifica se o grupo existe e está ativo
  const group = await dynamoDB.send(
    new GetCommand({
      TableName: "GroupsTable",
      Key: { id: groupId },
    })
  );

  if (!group.Item || group.Item.deletedAt) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Group not found" }),
    };
  }

  // Verifica se o usuário já tem uma relação com esse grupo
  const membership = await dynamoDB.send(
    new GetCommand({
      TableName: "GroupMembershipTable",
      Key: {
        userId,
        groupId,
      },
    })
  );

  if (membership.Item && membership.Item.status !== "inactive") {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Already a member" }),
    };
  }

  const groupType = group.Item.type; // "open" ou "closed"
  const status = groupType === "open" ? "active" : "pending";

  const newMembership = addMetadata({
    groupId,
    userId,
    role: "participant",
    status,
  });

  await dynamoDB.send(
    new PutCommand({
      TableName: "GroupMembershipTable",
      Item: newMembership,
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(newMembership),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});

export const leaveGroup = createHandler(async (event) => {
  const id = event.pathParameters?.groupId; // ID do grupo
  const userId = event.requestContext.authorizer?.claims?.sub; // ID do usuário

  // Verifica se o grupo existe
  const group = await dynamoDB.send(
    new GetCommand({
      TableName: "GroupsTable",
      Key: { id },
    })
  );

  if (!group.Item || group.Item.deletedAt) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Group not found" }),
    };
  }

  // Verifica se o usuário é membro do grupo
  const membership = await dynamoDB.send(
    new GetCommand({
      TableName: "GroupMembershipTable",
      Key: { userId, groupId: id },
    })
  );

  if (!membership.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "User not a member of the group" }),
    };
  }

  // Atualiza o status para "inactive"
  const updatedMembership = {
    ...membership.Item,
    status: "inactive",
    updatedAt: new Date().toISOString(),
  };

  await dynamoDB.send(
    new PutCommand({
      TableName: "GroupMembershipTable",
      Item: updatedMembership,
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Successfully left the group" }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});

export const updateMembershipStatus = createHandler(
  async (
    event: APIGatewayEventWithUserAndBody<{
      status?: "active" | "inactive";
      role?: "admin" | "participant";
      action?: "remove";
    }>
  ) => {
    const groupId = event.pathParameters?.groupId;
    const userId = event.pathParameters?.userId;
    const { status, role, action } = event.body || {};

    if (!groupId || !userId || (!status && !role && !action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing parameters" }),
      };
    }

    const requestingUserId = event.requestContext.authorizer?.claims?.sub;

    const requesterMembership = await dynamoDB.send(
      new GetCommand({
        TableName: "GroupMembershipTable",
        Key: {
          userId: requestingUserId,
          groupId,
        },
      })
    );

    if (
      !requesterMembership.Item ||
      requesterMembership.Item.status !== "active" ||
      requesterMembership.Item.role !== "admin"
    ) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: "Only group admins can perform this action",
        }),
      };
    }

    const updateExpressions = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, string | number | boolean | null> = {
      ":updatedAt": new Date().toISOString(),
    };

    if (action === "remove") {
      updateExpressions.push("#status = :inactive");
      expressionAttributeNames[":inactive"] = "inactive";
      expressionAttributeValues["#status"] = "status";
    }

    if (status) {
      updateExpressions.push("#status = :status");
      expressionAttributeNames["#status"] = "status";
      expressionAttributeValues[":status"] = status;
    }

    if (role) {
      updateExpressions.push("#role = :role");
      expressionAttributeNames["#role"] = "role";
      expressionAttributeValues[":role"] = role;
    }

    if (updateExpressions.length > 0) {
      await dynamoDB.send(
        new UpdateCommand({
          TableName: "GroupMembershipTable",
          Key: {
            userId,
            groupId,
          },
          UpdateExpression:
            "SET " + updateExpressions.join(", ") + ", updatedAt = :updatedAt",
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Membro atualizado com sucesso" }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
);

export const getGroupMembers = createHandler(
  async (event: APIGatewayEventWithUser) => {
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
  }
);
