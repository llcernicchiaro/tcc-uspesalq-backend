import { APIGatewayProxyEvent } from "aws-lambda";

export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
}

export type APIGatewayEventWithUser = APIGatewayProxyEvent & {
  locals?: {
    user?: AuthUser;
  };
};

export type APIGatewayEventWithUserAndBody<T> = Omit<
  APIGatewayEventWithUser,
  "body"
> & {
  body: T;
};
