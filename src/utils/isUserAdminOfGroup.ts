import { GetCommand } from "@aws-sdk/lib-dynamodb";

import { dynamoDB } from "./dynamodb.ts";

export const isUserAdminOfGroup = async (groupId: string, userId: string) => {
  const result = await dynamoDB.send(
    new GetCommand({
      TableName: "GroupMembershipTable",
      Key: { groupId, userId },
    })
  );

  if (!result.Item) {
    return false;
  }

  return result.Item.role === "admin";
};
