import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";

import { addMetadata } from "../utils/addMetadata.ts";

export const joinGroup = createHandler(async (event) => {
  const groupId = event.pathParameters?.id;
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
  const id = event.pathParameters?.id; // ID do grupo
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
