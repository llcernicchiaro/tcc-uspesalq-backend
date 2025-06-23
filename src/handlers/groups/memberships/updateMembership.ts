import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../../utils/createHandler.ts";
import { dynamoDB } from "../../../utils/dynamodb.ts";

import type { APIGatewayEventWithUserAndBody } from "../../../types/api-gateway.js";

export const handler = createHandler(
  async (
    event: APIGatewayEventWithUserAndBody<{
      status?: "active" | "inactive";
      role?: "admin" | "participant";
      action?: "remove";
    }>
  ) => {
    const groupId = event.pathParameters?.groupId;
    const userId = event.pathParameters?.userId;
    const { status, role, action } = event.body || {};

    if (!groupId || !userId || (!status && !role && !action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing parameters" }),
      };
    }

    const requestingUserId = event.requestContext.authorizer?.claims?.sub;

    const requesterMembership = await dynamoDB.send(
      new GetCommand({
        TableName: "GroupMembershipTable",
        Key: {
          userId: requestingUserId,
          groupId,
        },
      })
    );

    if (
      !requesterMembership.Item ||
      requesterMembership.Item.status !== "active" ||
      requesterMembership.Item.role !== "admin"
    ) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: "Only group admins can perform this action",
        }),
      };
    }

    const updateExpressions = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<
      string,
      string | number | boolean | null
    > = {
      ":updatedAt": new Date().toISOString(),
    };

    if (action === "remove") {
      updateExpressions.push("#status = :inactive");
      expressionAttributeNames[":inactive"] = "inactive";
      expressionAttributeValues["#status"] = "status";
    }

    if (status) {
      updateExpressions.push("#status = :status");
      expressionAttributeNames["#status"] = "status";
      expressionAttributeValues[":status"] = status;
    }

    if (role) {
      updateExpressions.push("#role = :role");
      expressionAttributeNames["#role"] = "role";
      expressionAttributeValues[":role"] = role;
    }

    if (updateExpressions.length > 0) {
      await dynamoDB.send(
        new UpdateCommand({
          TableName: "GroupMembershipTable",
          Key: {
            userId,
            groupId,
          },
          UpdateExpression:
            "SET " + updateExpressions.join(", ") + ", updatedAt = :updatedAt",
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Membro atualizado com sucesso" }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
);
