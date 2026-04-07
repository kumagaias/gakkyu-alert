/**
 * Lambda コンテナイメージ用 esbuild スクリプト
 *
 * build.mjs との主な違い:
 *   - @aws-sdk/* をバンドルに含める (コンテナはマネージドランタイムを使わないため)
 *   - ハンドラー名を引数で指定し、常に dist/handler.mjs として出力する
 *
 * 使い方:
 *   node build.lambda.mjs api
 *   node build.lambda.mjs collect-closures
 *   node build.lambda.mjs collect-sentinel
 *   node build.lambda.mjs send-alerts
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

/** @type {Record<string, string>} */
const HANDLERS = {
  "api":               "src/lambda.ts",
  "collect-closures":  "src/cron/collect-closures.ts",
  "collect-sentinel":  "src/cron/collect-sentinel.ts",
  "send-alerts":       "src/cron/send-alerts.ts",
};

const handlerName = process.argv[2];
if (!handlerName || !HANDLERS[handlerName]) {
  console.error(
    `Usage: node build.lambda.mjs <${Object.keys(HANDLERS).join("|")}>`
  );
  process.exit(1);
}

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");

await rm(distDir, { recursive: true, force: true });

await esbuild({
  // 出力ファイルを常に handler.mjs に固定 (Dockerfile の CMD と揃える)
  entryPoints: [{ in: path.resolve(artifactDir, HANDLERS[handlerName]), out: "handler" }],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: distDir,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  minify: true,
  sourcemap: "linked",
  // コンテナイメージではランタイムが @aws-sdk/* を提供しないため、
  // build.mjs と異なり @aws-sdk/* と aws-sdk をバンドルに含める。
  // ネイティブアドオン (.node) やプラットフォーム固有モジュールのみ外部化する。
  external: [
    "*.node",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "farmhash",
    "xxhash-addon",
    "bufferutil",
    "utf-8-validate",
    "ssh2",
    "cpu-features",
    "dtrace-provider",
    "isolated-vm",
    "lightningcss",
    "pg-native",
    "oracledb",
    "mongodb-client-encryption",
    "nodemailer",
    "handlebars",
    "knex",
    "typeorm",
    "protobufjs",
    "onnxruntime-node",
    "@tensorflow/*",
    "@prisma/client",
    "@mikro-orm/*",
    "@grpc/*",
    "@swc/*",
    "@opentelemetry/*",
    "@google-cloud/*",
    "@google/*",
    "googleapis",
    "firebase-admin",
    "@parcel/watcher",
    "@sentry/profiling-node",
    "@tree-sitter/*",
    "classic-level",
    "dd-trace",
    "ffi-napi",
    "grpc",
    "hiredis",
    "kerberos",
    "leveldown",
    "miniflare",
    "mysql2",
    "newrelic",
    "odbc",
    "piscina",
    "realm",
    "ref-napi",
    "rocksdb",
    "sass-embedded",
    "sequelize",
    "serialport",
    "snappy",
    "tinypool",
    "usb",
    "workerd",
    "wrangler",
    "zeromq",
    "zeromq-prebuilt",
    "playwright",
    "puppeteer",
    "puppeteer-core",
    "electron",
  ],
  plugins: [
    esbuildPluginPino({ transports: ["pino-pretty"] }),
  ],
  // CJS のみのパッケージ (express 等) を ESM 出力でも動かすためのシム
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});
