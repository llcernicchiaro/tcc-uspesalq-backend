import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../../utils/createHandler.ts";
import { dynamoDB } from "../../../utils/dynamodb.ts";
import { addMetadata } from "../../../utils/addMetadata.ts";

export const handler = createHandler(async (event) => {
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
