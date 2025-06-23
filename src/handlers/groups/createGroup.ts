import { PutCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../utils/createHandler.ts";
import { dynamoDB } from "../../utils/dynamodb.ts";
import { addMetadata } from "../../utils/addMetadata.ts";

import { validateWithZod } from "../../middlewares/validateWithZod.ts";

import {
  groupInputSchema,
  type GroupInput,
} from "../../types/schemas/group.ts";
import type { APIGatewayEventWithUserAndBody } from "../../types/api-gateway.js";

export const handler = createHandler(
  async (event: APIGatewayEventWithUserAndBody<GroupInput>) => {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const group = addMetadata(event.body);

    await dynamoDB.send(
      new PutCommand({
        TableName: "GroupsTable",
        Item: { ...group, imageUrl: group.imageUrl || null, isActive: 1 },
      })
    );

    // opcional: já insere o criador como admin no groupMembership
    await dynamoDB.send(
      new PutCommand({
        TableName: "GroupMembershipTable",
        Item: addMetadata({
          groupId: group.id,
          userId,
          role: "admin",
          status: "active",
        }),
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Group created", group }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  },
  [validateWithZod(groupInputSchema)]
);
