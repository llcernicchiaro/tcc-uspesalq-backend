import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createHandler } from "../utils/createHandler.ts";

import type { APIGatewayEventWithUserAndBody } from "../types/api-gateway.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const s3 = new S3Client({ region: "sa-east-1" });

export const handler = createHandler(
  async (event: APIGatewayEventWithUserAndBody<{ fileType: string }>) => {
    const resource = event.pathParameters?.resource; // 'group' or 'event'

    if (resource !== "group" && resource !== "event") {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid resource" }),
      };
    }

    const { fileType } = event.body;

    if (!fileType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "File type is required" }),
      };
    }

    if (!ALLOWED_TYPES.includes(fileType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid file type" }),
      };
    }

    const extension = fileType.split("/")[1];
    const key = `${resource}/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: `${resource}-image-bucket-lorenzotcc`,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    return {
      statusCode: 200,
      body: JSON.stringify({
        uploadUrl,
        fileUrl: `https://${resource}-image-bucket-lorenzotcc.s3.amazonaws.com/${key}`,
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
);
