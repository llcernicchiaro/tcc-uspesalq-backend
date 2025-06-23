import { BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../utils/createHandler.ts";
import { dynamoDB } from "../../utils/dynamodb.ts";
import { getParticipantCount } from "../../utils/getParticipantCount.ts";

import type { Group } from "../../types/schemas/group.ts";

export const handler = createHandler(async (event) => {
  const userId = event.requestContext.authorizer?.claims?.sub;
  // 1. Buscar os groupIds da membership
  const membershipResult = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "UserIdIndex", // ou remova se userId for a PK
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": userId,
      },
    })
  );

  const groupIds = membershipResult.Items?.map((item) => item.groupId) || [];

  if (groupIds.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify([]),
    };
  }

  // 2. Buscar os grupos com BatchGet
  const groupsResult = await dynamoDB.send(
    new BatchGetCommand({
      RequestItems: {
        GroupsTable: {
          Keys: groupIds.map((id) => ({ id })),
        },
      },
    })
  );

  // 3. Mapear os grupos para o formato correto
  const groups =
    (groupsResult.Responses?.GroupsTable as Group[]).filter(
      (group) => !group.deletedAt
    ) || [];

  const groupsWithRole = groups.map((group) => {
    const membership = membershipResult.Items?.find(
      (item) => item.groupId === group.id
    );
    return {
      ...group,
      role: membership?.role,
      status: membership?.status,
    };
  });

  const enrichedGroups = await Promise.all(
    groupsWithRole.map(async (group) => ({
      ...group,
      membersCount: await getParticipantCount(group.id),
    }))
  );

  return {
    statusCode: 200,
    body: JSON.stringify(enrichedGroups),
  };
});
