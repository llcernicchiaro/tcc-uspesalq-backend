import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayEvent, Handler } from "aws-lambda";

import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import httpErrorHandler from "@middy/http-error-handler";
import cors from "@middy/http-cors";

export const createHandler = (
  handler: Handler,
  additionalMiddlewares: MiddlewareObj<APIGatewayEvent>[] = []
) => {
  const base = middy(handler)
    .use(jsonBodyParser())
    .use(httpErrorHandler())
    .use(cors());

  additionalMiddlewares.forEach((middleware) => base.use(middleware));

  return base;
};
