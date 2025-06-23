import {
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../utils/createHandler.ts";
import { dynamoDB } from "../../utils/dynamodb.ts";
import { isUserAdminOfGroup } from "../../utils/isUserAdminOfGroup.ts";

export const handler = createHandler(async (event) => {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const id = event.pathParameters?.groupId;

  const group = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupsTable",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": id,
      },
    })
  );

  if (!group.Items?.length) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Group not found" }),
    };
  }

  if (group.Items[0].deletedAt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Grupo já foi deletado." }),
    };
  }

  const groupItem = group.Items[0];
  const isAdmin = await isUserAdminOfGroup(groupItem.id, userId);

  if (!isAdmin) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: "Only admins can delete the group" }),
    };
  }

  const deletedAt = new Date().toISOString();

  await dynamoDB.send(
    new UpdateCommand({
      TableName: "GroupsTable",
      Key: { id },
      UpdateExpression: "SET deletedAt = :deletedAt, isActive = :isActive",
      ExpressionAttributeValues: {
        ":deletedAt": deletedAt,
        ":isActive": 0,
      },
    })
  );

  // Busca todos os usuários relacionados ao grupo na groupMembership
  const queryResult = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "GroupIdIndex",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": id,
      },
    })
  );

  const memberships = queryResult.Items || [];

  // Deleta todas as entradas da groupMembership em lote (máximo 25 por Batch)
  const deleteRequests = memberships.map((item) => ({
    DeleteRequest: {
      Key: {
        groupId: item.groupId,
        userId: item.userId,
      },
    },
  }));

  if (deleteRequests.length > 0) {
    await dynamoDB.send(
      new BatchWriteCommand({
        RequestItems: {
          groupMembership: deleteRequests,
        },
      })
    );
  }

  // DynamoDB permite até 25 operações por batch
  const batches = [];
  while (deleteRequests.length) {
    batches.push(deleteRequests.splice(0, 25));
  }

  for (const batch of batches) {
    await dynamoDB.send(
      new BatchWriteCommand({
        RequestItems: {
          groupMembership: batch,
        },
      })
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Group deleted" }),
  };
});
