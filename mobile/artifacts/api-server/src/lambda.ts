/**
 * Lambda ハンドラー — API Gateway プロキシ統合
 *
 * Express アプリを @vendia/serverless-express でラップして
 * Lambda + API Gateway (/{proxy+}) から呼び出せるようにする。
 */

import serverlessExpress from "@vendia/serverless-express";
import app from "./app.js";

const REQUIRED_ENV = ["ADMIN_TOKEN"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

export const handler = serverlessExpress({ app });
