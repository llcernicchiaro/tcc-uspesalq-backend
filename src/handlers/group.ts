import { randomUUID } from "node:crypto";
import {
  QueryCommand,
  PutCommand,
  UpdateCommand,
  BatchGetCommand,
  BatchWriteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createHandler } from "../utils/handlers.ts";
import { dynamoDB } from "../utils/dynamodb.ts";
import { addMetadata } from "../utils/addMetadata.ts";
import { isUserAdminOfGroup } from "../utils/isUserAdminOfGroup.ts";

import { validateWithZod } from "../middlewares/validateWithZod.ts";

import {
  groupInputSchema,
  groupUpdateSchema,
  type Group,
  type GroupInput,
  type GroupUpdate,
} from "../types/schemas/group.ts";
import type { APIGatewayEventWithUserAndBody } from "../types/api-gateway.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const s3 = new S3Client({ region: "sa-east-1" });

const getParticipantCount = async (groupId: string) => {
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "GroupIdIndex",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": groupId,
      },
      Select: "COUNT",
    })
  );

  return result.Count ?? 0;
};

export const getGroupsByUser = createHandler(async (event) => {
  const userId = event.requestContext.authorizer?.claims?.sub;
  // 1. Buscar os groupIds da membership
  const membershipResult = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "UserIdIndex", // ou remova se userId for a PK
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": userId,
      },
    })
  );

  const groupIds = membershipResult.Items?.map((item) => item.groupId) || [];

  if (groupIds.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify([]),
    };
  }

  // 2. Buscar os grupos com BatchGet
  const groupsResult = await dynamoDB.send(
    new BatchGetCommand({
      RequestItems: {
        GroupsTable: {
          Keys: groupIds.map((id) => ({ id })),
        },
      },
    })
  );

  // 3. Mapear os grupos para o formato correto
  const groups =
    (groupsResult.Responses?.GroupsTable as Group[]).filter(
      (group) => !group.deletedAt
    ) || [];

  const groupsWithRole = groups.map((group) => {
    const membership = membershipResult.Items?.find(
      (item) => item.groupId === group.id
    );
    return {
      ...group,
      role: membership?.role,
    };
  });

  const enrichedGroups = await Promise.all(
    groupsWithRole.map(async (group) => ({
      ...group,
      membersCount: await getParticipantCount(group.id),
    }))
  );

  return {
    statusCode: 200,
    body: JSON.stringify(enrichedGroups),
  };
});

export const createGroup = createHandler(
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

export const getGroups = createHandler(async (event) => {
  const userId = event.requestContext.authorizer?.claims?.sub;

  const groupsData = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupsTable",
      IndexName: "IsActiveIndex",
      KeyConditionExpression: "isActive = :active",
      ExpressionAttributeValues: {
        ":active": 1,
      },
    })
  );

  const allGroups = groupsData.Items ?? [];

  // 2. Buscar grupos que o usuário participa
  const membershipsData = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ProjectionExpression: "groupId",
    })
  );

  const userGroupIds = new Set(
    (membershipsData.Items ?? []).map((item) => item.groupId)
  );

  const enrichedGroups = await Promise.all(
    allGroups.map(async (group) => ({
      ...group,
      membersCount: await getParticipantCount(group.id),
      isMember: userGroupIds.has(group.id),
    }))
  );

  return {
    statusCode: 200,
    body: JSON.stringify(enrichedGroups),
  };
});

export const updateGroup = createHandler(
  async (event: APIGatewayEventWithUserAndBody<GroupUpdate>) => {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const id = event.pathParameters?.id;
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

    await dynamoDB.send(
      new UpdateCommand({
        TableName: "GroupsTable",
        Key: { id },
        UpdateExpression:
          "SET #name = :name, #description = :description, #imageUrl = :imageUrl",
        ExpressionAttributeNames: {
          "#name": "name",
          "#description": "description",
          "#imageUrl": "imageUrl",
        },
        ExpressionAttributeValues: {
          ":name": name,
          ":description": description,
          ":imageUrl": imageUrl,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Group updated" }),
    };
  },
  [validateWithZod(groupUpdateSchema)]
);

export const deleteGroup = createHandler(async (event) => {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const id = event.pathParameters?.id;

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

  if (group.Items[0].deletedAt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Grupo já foi deletado." }),
    };
  }

  const groupItem = group.Items[0];
  const isAdmin = await isUserAdminOfGroup(groupItem.id, userId);

  if (!isAdmin) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: "Only admins can delete the group" }),
    };
  }

  const deletedAt = new Date().toISOString();

  await dynamoDB.send(
    new UpdateCommand({
      TableName: "GroupsTable",
      Key: { id },
      UpdateExpression: "SET deletedAt = :deletedAt, isActive = :isActive",
      ExpressionAttributeValues: {
        ":deletedAt": deletedAt,
        ":isActive": 0,
      },
    })
  );

  // Busca todos os usuários relacionados ao grupo na groupMembership
  const queryResult = await dynamoDB.send(
    new QueryCommand({
      TableName: "GroupMembershipTable",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": id,
      },
    })
  );

  const memberships = queryResult.Items || [];

  // Deleta todas as entradas da groupMembership em lote (máximo 25 por Batch)
  const deleteRequests = memberships.map((item) => ({
    DeleteRequest: {
      Key: {
        groupId: item.groupId,
        userId: item.userId,
      },
    },
  }));

  if (deleteRequests.length > 0) {
    await dynamoDB.send(
      new BatchWriteCommand({
        RequestItems: {
          groupMembership: deleteRequests,
        },
      })
    );
  }

  // DynamoDB permite até 25 operações por batch
  const batches = [];
  while (deleteRequests.length) {
    batches.push(deleteRequests.splice(0, 25));
  }

  for (const batch of batches) {
    await dynamoDB.send(
      new BatchWriteCommand({
        RequestItems: {
          groupMembership: batch,
        },
      })
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Group deleted" }),
  };
});

export const getGroup = createHandler(
  async (event: APIGatewayEventWithUserAndBody<GroupInput>) => {
    const id = event.pathParameters?.id;

    const group = await dynamoDB.send(
      new GetCommand({
        TableName: "GroupsTable",
        Key: { id },
      })
    );

    if (!group.Item || group.Item.deletedAt) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Group not found" }),
      };
    }

    const membersResult = await dynamoDB.send(
      new QueryCommand({
        TableName: "GroupMembershipTable",
        IndexName: "GroupIdIndex",
        KeyConditionExpression: "groupId = :groupId",
        ExpressionAttributeValues: {
          ":groupId": id,
        },
      })
    );

    const members = membersResult.Items || [];
    const userIds = members.map((member) => member.userId);

    const userResult = await dynamoDB.send(
      new BatchGetCommand({
        RequestItems: { UsersTable: { Keys: userIds.map((id) => ({ id })) } },
      })
    );

    const users = userResult.Responses?.UsersTable || [];

    const mappedMembers = members.map(({ userId, role }) => ({
      userId,
      role,
      name: users[userId]?.name || null,
      picture: users[userId]?.picture || null,
    }));

    const eventsResult = await dynamoDB.send(
      new QueryCommand({
        TableName: "EventsTable",
        IndexName: "GroupIdIndex",
        KeyConditionExpression: "groupId = :groupId",
        ExpressionAttributeValues: {
          ":groupId": id,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...group.Item,
        isMember: members.some(
          (member) =>
            member.userId === event.requestContext.authorizer?.claims?.sub
        ),
        membersCount: members.length,
        members: mappedMembers,
        events: eventsResult.Items,
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
);

export const getPresignedUploadUrl = createHandler(
  async (event: APIGatewayEventWithUserAndBody<{ fileType: string }>) => {
    const { fileType } = event.body;

    if (!fileType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "fileType is required" }),
      };
    }

    if (!ALLOWED_TYPES.includes(fileType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Formato de arquivo inválido" }),
      };
    }

    const extension = fileType.split("/")[1];
    const key = `groups/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: "group-image-bucket-lorenzotcc",
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    return {
      statusCode: 200,
      body: JSON.stringify({
        uploadUrl,
        fileUrl: `https://group-image-bucket-lorenzotcc.s3.amazonaws.com/${key}`,
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
);
