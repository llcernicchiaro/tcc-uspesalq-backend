// src/handlers/groups/events/updateEvent.ts
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { createHandler } from "../../../utils/createHandler.ts";
import { dynamoDB } from "../../../utils/dynamodb.ts";
import { isUserAdminOfGroup } from "../../../utils/isUserAdminOfGroup.ts";

import { validateWithZod } from "../../../middlewares/validateWithZod.ts";

import {
  eventUpdateSchema,
  type EventUpdate,
} from "../../../types/schemas/event.ts";
import type { APIGatewayEventWithUserAndBody } from "../../../types/api-gateway.js";

const s3 = new S3Client({ region: "sa-east-1" });
const EVENT_BUCKET = "event-image-bucket-lorenzotcc";

export const handler = createHandler(
  async (event: APIGatewayEventWithUserAndBody<EventUpdate>) => {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const groupId = event.pathParameters?.groupId;
    const eventId = event.pathParameters?.eventId;
    const { name, description, date, location, imageUrl } = event.body;

    if (!groupId || !eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing groupId or eventId" }),
      };
    }

    // 1. Verifica se o usuário é admin do grupo
    const isAdmin = await isUserAdminOfGroup(groupId, userId);
    if (!isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: "Only group admins can update events",
        }),
      };
    }

    // 2. Busca o evento existente
    const { Item: existing } = await dynamoDB.send(
      new GetCommand({
        TableName: "EventsTable",
        Key: { id: eventId },
      })
    );
    if (!existing || existing.groupId !== groupId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Event not found" }),
      };
    }

    // 3. Deleta imagem antiga se a URL mudou
    if (imageUrl && existing.imageUrl && existing.imageUrl !== imageUrl) {
      const oldKey = existing.imageUrl.split(".com/")[1];
      await s3.send(
        new DeleteObjectCommand({
          Bucket: EVENT_BUCKET,
          Key: oldKey,
        })
      );
    }

    // 4. Monta update dinâmico
    const updateExpressions: string[] = [];
    const exprAttrNames: Record<string, string> = {};
    const exprAttrValues: Record<string, string | number | boolean | null> = {};

    if (name) {
      updateExpressions.push("#name = :name");
      exprAttrNames["#name"] = "name";
      exprAttrValues[":name"] = name;
    }
    if (description !== undefined) {
      updateExpressions.push("#description = :description");
      exprAttrNames["#description"] = "description";
      exprAttrValues[":description"] = description;
    }
    if (date) {
      updateExpressions.push("#date = :date");
      exprAttrNames["#date"] = "date";
      exprAttrValues[":date"] = date;
    }
    if (location !== undefined) {
      updateExpressions.push("#location = :location");
      exprAttrNames["#location"] = "location";
      exprAttrValues[":location"] = location;
    }
    if (imageUrl) {
      updateExpressions.push("#imageUrl = :imageUrl");
      exprAttrNames["#imageUrl"] = "imageUrl";
      exprAttrValues[":imageUrl"] = imageUrl;
    }

    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Nothing to update" }),
      };
    }

    // always update updatedAt
    updateExpressions.push("updatedAt = :updatedAt");
    exprAttrValues[":updatedAt"] = new Date().toISOString();

    // 5. Executa o UpdateCommand
    await dynamoDB.send(
      new UpdateCommand({
        TableName: "EventsTable",
        Key: { id: eventId },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Event updated successfully" }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  },
  [validateWithZod(eventUpdateSchema)]
);
