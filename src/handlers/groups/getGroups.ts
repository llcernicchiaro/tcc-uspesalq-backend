import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../utils/createHandler.ts";
import { dynamoDB } from "../../utils/dynamodb.ts";
import { getParticipantCount } from "../../utils/getParticipantCount.ts";

export const handler = createHandler(async (event) => {
  const userId = event.requestContext.authorizer?.claims?.sub;

  const groupsData = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupsTable",
      IndexName: "IsActiveIndex",
      KeyConditionExpression: "isActive = :active",
      ExpressionAttributeValues: {
        ":active": 1,
      },
    })
  );

  const allGroups = groupsData.Items ?? [];

  // 2. Buscar grupos que o usuário participa
  const membershipsData = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ProjectionExpression: "groupId",
    })
  );

  const userGroupIds = new Set(
    (membershipsData.Items ?? []).map((item) => item.groupId)
  );

  const enrichedGroups = await Promise.all(
    allGroups.map(async (group) => ({
      ...group,
      membersCount: await getParticipantCount(group.id),
      isMember: userGroupIds.has(group.id),
    }))
  );

  return {
    statusCode: 200,
    body: JSON.stringify(enrichedGroups),
  };
});
