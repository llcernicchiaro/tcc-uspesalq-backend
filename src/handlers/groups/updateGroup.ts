import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";

import { createHandler } from "../../utils/createHandler.ts";
import { dynamoDB } from "../../utils/dynamodb.ts";
import { isUserAdminOfGroup } from "../../utils/isUserAdminOfGroup.ts";

import { validateWithZod } from "../../middlewares/validateWithZod.ts";

import {
  groupUpdateSchema,
  type GroupUpdate,
} from "../../types/schemas/group.ts";
import type { APIGatewayEventWithUserAndBody } from "../../types/api-gateway.js";

const s3 = new S3Client({ region: "sa-east-1" });

export const handler = createHandler(
  async (event: APIGatewayEventWithUserAndBody<GroupUpdate>) => {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const id = event.pathParameters?.groupId;
    const { name, description, imageUrl } = event.body;

    const group = await dynamoDB.send(
      new QueryCommand({
        TableName: "GroupsTable",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
          ":id": id,
        },
      })
    );

    if (!group.Items?.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Group not found" }),
      };
    }

    const groupItem = group.Items[0];
    const isAdmin = await isUserAdminOfGroup(groupItem.id, userId);

    if (!isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    // 3. Deleta imagem antiga se necessário
    if (imageUrl && groupItem.imageUrl && groupItem.imageUrl !== imageUrl) {
      const oldKey = groupItem.imageUrl.split(".com/")[1];
      await s3.send(
        new DeleteObjectCommand({
          Bucket: "group-image-bucket-lorenzotcc",
          Key: oldKey,
        })
      );
    }

    // 4. Monta update dinâmico
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, string | number | boolean> =
      {};
    const expressionAttributeNames: Record<string, string> = {};

    if (name) {
      updateExpressions.push("#name = :name");
      expressionAttributeValues[":name"] = name;
      expressionAttributeNames["#name"] = "name";
    }

    if (description) {
      updateExpressions.push("#description = :description");
      expressionAttributeValues[":description"] = description;
      expressionAttributeNames["#description"] = "description";
    }

    if (imageUrl) {
      updateExpressions.push("#imageUrl = :imageUrl");
      expressionAttributeValues[":imageUrl"] = imageUrl;
      expressionAttributeNames["#imageUrl"] = "imageUrl";
    }

    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Nada para atualizar" }),
      };
    }

    // 5. Atualiza no DynamoDB
    await dynamoDB.send(
      new UpdateCommand({
        TableName: "GroupsTable",
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Group updated" }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  },
  [validateWithZod(groupUpdateSchema)]
);
