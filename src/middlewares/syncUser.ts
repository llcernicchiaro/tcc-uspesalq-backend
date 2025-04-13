import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyResult } from "aws-lambda";
import type { APIGatewayEventWithUser } from "../types/api-gateway.d.ts";

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB } from "../utils/dynamodb.ts";

export const syncUser = (): MiddlewareObj<
  APIGatewayEventWithUser,
  APIGatewayProxyResult
> => {
  const middleware: MiddlewareObj = {
    before: async (request) => {
      if (process.env.NODE_ENV === "development") {
        console.log("Desativando o middleware userSync no ambiente de desenvolvimento.");
        return;
      }

      const event = request.event as APIGatewayEventWithUser;
      const claims = event.requestContext.authorizer?.jwt?.claims;

      if (!claims?.sub) {
        throw new Error("Unauthorized: missing user sub in token");
      }

      const userId = claims.sub;
      const name = claims.name || "";
      const email = claims.email || "";

      const { Item } = await dynamoDB.send(
        new GetCommand({
          TableName: "UsersTable",
          Key: { id: userId },
        })
      );

      if (!Item) {
        await dynamoDB.send(
          new PutCommand({
            TableName: "UsersTable",
            Item: {
              id: userId,
              name,
              email,
              createdAt: new Date().toISOString(),
            },
          })
        );
      }

      // Adiciona o userId e email ao contexto para ser reutilizado
      event.locals = {
        ...event.locals,
        user: {
          id: userId,
          name,
          email,
        },
      };
    },
  };

  return middleware;
};
