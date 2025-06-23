import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler } from "../../../utils/createHandler.ts";
import { dynamoDB } from "../../../utils/dynamodb.ts";
import { addMetadata } from "../../../utils/addMetadata.ts";

import { validateWithZod } from "../../../middlewares/validateWithZod.ts";

import {
  eventInputSchema,
  type EventInput,
} from "../../../types/schemas/event.ts";
import type { APIGatewayEventWithUserAndBody } from "../../../types/api-gateway.js";

export const handler = createHandler(
  async (event: APIGatewayEventWithUserAndBody<EventInput>) => {
    const groupId = event.pathParameters?.groupId;
    const userId = event.requestContext.authorizer?.claims?.sub;

    if (!groupId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing groupId in path" }),
      };
    }

    // Verifica se o usuário é admin do grupo
    const membership = await dynamoDB.send(
      new GetCommand({
        TableName: "GroupMembershipTable",
        Key: { groupId, userId },
      })
    );

    if (
      !membership.Item ||
      membership.Item.status !== "active" ||
      membership.Item.role !== "admin"
    ) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: "Only group admins can create events",
        }),
      };
    }

    // Cria o evento
    const eventData = event.body;
    const newEvent = addMetadata({
      ...eventData,
      groupId,
    });

    await dynamoDB.send(
      new PutCommand({
        TableName: "EventsTable",
        Item: newEvent,
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Event created", event: newEvent }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  },
  [validateWithZod(eventInputSchema)]
);
