# syntax=docker/dockerfile:1.9
#
# Lambda コンテナイメージ — がっきゅうアラート
#
# ビルド:
#   docker build --build-arg HANDLER=api          -t gakkyu-alert-api .
#   docker build --build-arg HANDLER=collect-closures  -t gakkyu-alert-collect-closures .
#   docker build --build-arg HANDLER=collect-sentinel  -t gakkyu-alert-collect-sentinel .
#   docker build --build-arg HANDLER=send-alerts   -t gakkyu-alert-send-alerts .
#
# Lint (要 hadolint):
#   hadolint Dockerfile

###############################################################################
# Stage: base — pnpm + corepack (全ビルドステージで共有)
###############################################################################
FROM node:22-bookworm-slim AS base

# PNPM_HOME にバイナリを置き、COREPACK_ENABLE_DOWNLOAD_FALLBACK=0 で
# ネットワーク到達不能時に失敗させる (予期しないフォールバックを防止)
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_FALLBACK=0

RUN corepack enable pnpm

WORKDIR /workspace

###############################################################################
# Stage: deps — ワークスペース依存関係のインストール
#
# マニフェスト (package.json / lockfile) だけを先にコピーする。
# ソースコードの変更ではこのレイヤーのキャッシュが壊れないため、
# pnpm install を毎回スキップできる。
###############################################################################
FROM base AS deps

# ワークスペースルートのマニフェスト
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# 各パッケージのマニフェスト (ソースは含めない)
COPY artifacts/api-server/package.json     artifacts/api-server/
COPY artifacts/app/package.json            artifacts/app/
COPY artifacts/gakkyu-alert/package.json   artifacts/gakkyu-alert/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY lib/api-zod/package.json              lib/api-zod/
COPY lib/api-client-react/package.json     lib/api-client-react/
COPY lib/api-spec/package.json             lib/api-spec/
COPY lib/db/package.json                   lib/db/

# pnpm コンテンツストアをキャッシュマウントに保持し、
# イメージレイヤーには含めない (--mount=type=cache はビルド時のみ使用)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

###############################################################################
# Stage: ric — Lambda Runtime Interface Client
#
# pnpm ワークスペースとは隔離してインストールする。
# aws-lambda-ric だけを final ステージにコピーする。
###############################################################################
FROM node:22-bookworm-slim AS ric

WORKDIR /ric

# aws-lambda-ric@3 はネイティブアドオンのビルドに cmake / make / g++ / python3 が必要
# aws-lambda-ric は autoconf/automake/cmake/libtool/g++ が必要なネイティブアドオン。
# build-essential で gcc/g++/make をまとめて取得する。ビルドツールは final に含まれない。
# hadolint ignore=DL3008
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential autoconf automake cmake libtool python3 && \
    rm -rf /var/lib/apt/lists/*

RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev aws-lambda-ric@3

###############################################################################
# Stage: builder — 型チェック + esbuild バンドル
#
# ソースコードの変更は deps キャッシュに影響しない。
###############################################################################
FROM deps AS builder

# HANDLER はここで受け取る (ARG はステージをまたぐと引き継がれない)
ARG HANDLER=api

# ソースコードをコピー (package.json は deps で既にコピー済み)
COPY tsconfig.base.json tsconfig.json ./
COPY lib/api-zod/          lib/api-zod/
COPY lib/db/               lib/db/
COPY lib/api-spec/         lib/api-spec/
COPY lib/api-client-react/ lib/api-client-react/
COPY artifacts/api-server/ artifacts/api-server/

# 1. lib パッケージの型チェック (プロジェクト参照)
# 2. api-server の型チェック
# 型エラーがあればここで失敗し、バンドルは実行されない
RUN pnpm run typecheck:libs && \
    pnpm --filter @workspace/api-server run typecheck

# esbuild でバンドル → dist/handler.mjs
# @aws-sdk/* はバンドルに含める (コンテナはマネージドランタイムを持たないため)
RUN node artifacts/api-server/build.lambda.mjs "${HANDLER}"

###############################################################################
# Stage: final — distroless ランタイム
#
# シェルなし・パッケージマネージャーなし・root ユーザーなし。
# 攻撃対象領域を最小化した本番イメージ。
#
# nonroot ユーザー: UID/GID = 65532
###############################################################################
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS final

WORKDIR /app

# Lambda Runtime Interface Client (aws-lambda-ric)
COPY --from=ric     --chown=65532:65532 /ric/node_modules/                    node_modules/

# バンドル済みハンドラー + pino ワーカースレッドファイル
COPY --from=builder --chown=65532:65532 /workspace/artifacts/api-server/dist/ dist/

# ENTRYPOINT: Lambda RIC が イベントを受信してハンドラーを呼び出す
# CMD:        Lambda 関数設定で上書き可能なハンドラー文字列
#             形式: <モジュールパス(拡張子なし)>.<エクスポート名>
ENTRYPOINT ["/nodejs/bin/node", "/app/node_modules/.bin/aws-lambda-ric"]
CMD ["dist/handler.handler"]
