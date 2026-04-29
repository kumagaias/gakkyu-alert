/**
 * DynamoDB クライアント & テーブルアクセスヘルパー
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// テーブル名は環境変数から取得
export const TABLES = {
  MASTERS:   process.env.TABLE_MASTERS   ?? "gakkyu-alert-masters-dev",
  SNAPSHOTS: process.env.TABLE_SNAPSHOTS ?? "gakkyu-alert-snapshots-dev",
  DEVICES:   process.env.TABLE_DEVICES   ?? "gakkyu-alert-devices-dev",
  SCHOOLS:   process.env.TABLE_SCHOOLS   ?? "gakkyu-alert-schools-dev",
} as const;

// TTL: 90日後 (スナップショット用)
export function ttl90Days(): number {
  return Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
}

// ---------------------------------------------------------------------------
// スナップショットテーブル操作
// ---------------------------------------------------------------------------

export async function putSnapshot(
  pk: string,
  sk: string,
  data: Record<string, unknown>
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.SNAPSHOTS,
      Item: {
        pk,
        sk,
        ...data,
        ttlEpoch: ttl90Days(),
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function getSnapshotByKey<T = Record<string, unknown>>(
  pk: string,
  sk: string
): Promise<T | null> {
  const res = await docClient.send(
    new GetCommand({ TableName: TABLES.SNAPSHOTS, Key: { pk, sk } })
  );
  return (res.Item as T) ?? null;
}

export async function getLatestSnapshot<T = Record<string, unknown>>(
  pk: string
): Promise<T | null> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLES.SNAPSHOTS,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return (res.Items?.[0] as T) ?? null;
}

export async function querySnapshots<T = Record<string, unknown>>(
  input: Omit<QueryCommandInput, "TableName">
): Promise<T[]> {
  const res = await docClient.send(
    new QueryCommand({ TableName: TABLES.SNAPSHOTS, ...input })
  );
  return (res.Items ?? []) as T[];
}

// ---------------------------------------------------------------------------
// マスタテーブル操作
// ---------------------------------------------------------------------------

export async function queryMasters<T = Record<string, unknown>>(
  pk: string
): Promise<T[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLES.MASTERS,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
    })
  );
  return (res.Items ?? []) as T[];
}

// ---------------------------------------------------------------------------
// デバイステーブル操作
// ---------------------------------------------------------------------------

export async function putDevice(
  fcmToken: string,
  data: Record<string, unknown>
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.DEVICES,
      Item: {
        pk: "DEVICE",
        sk: fcmToken,
        ...data,
        ttlEpoch: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteDevice(fcmToken: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.DEVICES,
      Key: { pk: "DEVICE", sk: fcmToken },
    })
  );
}

export async function queryDevicesByDistrict<T = Record<string, unknown>>(
  homeDistrictId: string
): Promise<T[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLES.DEVICES,
      IndexName: "homeDistrict-index",
      KeyConditionExpression: "homeDistrictId = :district",
      ExpressionAttributeValues: { ":district": homeDistrictId },
    })
  );
  return (res.Items ?? []) as T[];
}

/** 全デバイスを paginate しながら取得 */
export async function queryAllDevices<T = Record<string, unknown>>(): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLES.DEVICES,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "DEVICE" },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );
    items.push(...((res.Items ?? []) as T[]));
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

/** デバイスをページング取得（管理画面用） */
export async function queryDevicesPaged<T = Record<string, unknown>>(opts: {
  limit: number;
  lastKey?: Record<string, unknown>;
}): Promise<{ items: T[]; lastKey?: Record<string, unknown> }> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLES.DEVICES,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "DEVICE" },
      Limit: opts.limit,
      ...(opts.lastKey ? { ExclusiveStartKey: opts.lastKey } : {}),
    })
  );
  return {
    items: (res.Items ?? []) as T[],
    lastKey: res.LastEvaluatedKey as Record<string, unknown> | undefined,
  };
}
