import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB } from "./dynamodb.ts";

export const getParticipantCount = async (groupId: string) => {
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "GroupIdIndex",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": groupId,
      },
      Select: "COUNT",
    })
  );

  return result.Count ?? 0;
};
