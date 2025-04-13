import { ScanCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";

export const listUsers = createHandler(async () => {
  const result = await dynamoDB.send(
    new ScanCommand({ TableName: "UsersTable" })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
});
