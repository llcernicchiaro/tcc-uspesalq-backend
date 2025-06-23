import {
  QueryCommand,
  BatchGetCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../utils/createHandler.ts";
import { dynamoDB } from "../../utils/dynamodb.ts";

export const handler = createHandler(async (event) => {
  const id = event.pathParameters?.groupId;

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

  const membersResult = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "GroupIdIndex",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": id,
      },
    })
  );

  const members = membersResult.Items || [];
  const userIds = members.map((member) => member.userId);

  const userResult = await dynamoDB.send(
    new BatchGetCommand({
      RequestItems: { UsersTable: { Keys: userIds.map((id) => ({ id })) } },
    })
  );

  const users = userResult.Responses?.UsersTable || [];

  const usersMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<string, { name: string; picture: string }>);

  const mappedMembers = members.map(({ userId, role }) => ({
    userId,
    role,
    name: usersMap[userId]?.name || null,
    picture: usersMap[userId]?.picture || null,
  }));

  const eventsResult = await dynamoDB.send(
    new QueryCommand({
      TableName: "EventsTable",
      IndexName: "GroupIdIndex",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": id,
      },
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      ...group.Item,
      role: members.find(
        (member) =>
          member.userId === event.requestContext.authorizer?.claims?.sub
      )?.role,
      status: members.find(
        (member) =>
          member.userId === event.requestContext.authorizer?.claims?.sub
      )?.status,
      isMember: members.some(
        (member) =>
          member.userId === event.requestContext.authorizer?.claims?.sub
      ),
      membersCount: members.length,
      members: mappedMembers,
      events: eventsResult.Items,
    }),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
});
