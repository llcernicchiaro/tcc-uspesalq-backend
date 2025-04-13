import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyResult } from "aws-lambda";
import type { APIGatewayEventWithUserAndBody } from "../types/api-gateway.d.ts";

import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import jsonBodyParser from "@middy/http-json-body-parser";
import httpErrorHandler from "@middy/http-error-handler";
import cors from "@middy/http-cors";
import { syncUser } from "../middlewares/syncUser.ts";

type HandlerFunction<TBody> = (
  event: APIGatewayEventWithUserAndBody<TBody>
) => Promise<APIGatewayProxyResult>;

export const createHandler = <TBody>(
  handler: HandlerFunction<TBody>,
  additionalMiddlewares: MiddlewareObj<
    APIGatewayEventWithUserAndBody<TBody>
  >[] = []
) => {
  const base = middy(handler)
    .use(httpHeaderNormalizer())
    .use(jsonBodyParser())
    .use(httpErrorHandler())
    .use(syncUser())
    .use(cors());

  additionalMiddlewares.forEach((middleware) => base.use(middleware));

  return base;
};
