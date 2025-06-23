import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../../utils/createHandler.ts";
import { dynamoDB } from "../../../utils/dynamodb.ts";

export const handler = createHandler(async (event) => {
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
