# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**がっきゅうアラート** (Gakkyu Alert) — a school class-closure alert system monitoring Tokyo districts (練馬区, 杉並区, 武蔵野市) for influenza/COVID outbreaks.

- `poc/alert_multi.js` — standalone Node.js proof-of-concept script (no build step; run with `node poc/alert_multi.js`)
- `mobile/` — pnpm workspace monorepo for the full application

## Infra commands (run from `infra/environments/dev/`)

```bash
# First time only — create the S3 state bucket
bash ../../scripts/create-state-bucket.sh

terraform init
terraform plan
terraform apply
```

`github_token` must be set (never committed). Options:
- `cp terraform.tfvars.example terraform.tfvars` then fill in the token
- Or export `TF_VAR_github_token=<token>` in your shell

## App commands (run from `mobile/`)

```bash
pnpm run typecheck                                      # typecheck all packages
pnpm run build                                          # typecheck + build all packages
pnpm --filter @workspace/app run start                  # start Expo dev server (iOS/Android/Web)
pnpm --filter @workspace/app run build:web              # export static web build → artifacts/app/dist/
pnpm --filter @workspace/api-server run dev             # start API server locally
pnpm --filter @workspace/api-spec run codegen           # regenerate Zod schemas + React Query hooks from openapi.yaml
pnpm --filter @workspace/db run push                    # push Drizzle schema to DB (dev only)
```

## Infra Architecture (`infra/`)

Terraform 1.14 · AWS Amplify for web hosting · S3 remote state with native locking (`use_lockfile = true`, no DynamoDB).

```
infra/
├── .mise.toml                        # mise: terraform = "1.14"
├── modules/amplify/                  # reusable Amplify module
└── environments/dev/
    ├── main.tf                       # provider + default_tags (Environment, Project)
    ├── backend.tf                    # S3 backend, key = dev/terraform.tfstate
    ├── amplify-build-spec.yml        # Amplify CI build spec for Expo web
    └── terraform.tfvars.example      # copy → terraform.tfvars (git-ignored)
```

`infra/scripts/create-state-bucket.sh` — run once to provision the S3 state bucket before `terraform init`.

## Monorepo Architecture (`mobile/`)

**Stack:** pnpm workspaces · Node 24 · TypeScript 5.9 · Express 5 · PostgreSQL + Drizzle ORM · Zod v4 · TanStack Query · Orval codegen · esbuild

### Package layout

| Path | Package | Role |
|---|---|---|
| `artifacts/app/` | `@workspace/app` | Expo 53 + Expo Router app (iOS/Android/Web); `build:web` exports to `dist/` for Amplify |
| `artifacts/api-server/` | `@workspace/api-server` | Express 5 REST API; routes under `/api`; built to CJS bundle via esbuild |
| `artifacts/mockup-sandbox/` | — | Vite + React dev sandbox for component previews; access at `/preview/<ComponentName>` |
| `lib/db/` | `@workspace/db` | Drizzle ORM schema + Postgres client; exports `./` and `./schema` |
| `lib/api-spec/` | `@workspace/api-spec` | `openapi.yaml` + Orval config; codegen target for the two packages below |
| `lib/api-zod/` | `@workspace/api-zod` | **Generated** — Zod request/response validators (do not edit manually) |
| `lib/api-client-react/` | `@workspace/api-client-react` | **Generated** — TanStack Query hooks (do not edit manually) |

### Key design patterns

- **API type safety pipeline:** `openapi.yaml` → Orval → `api-zod` (Zod validators) + `api-client-react` (React Query hooks). Always edit `openapi.yaml` first, then run codegen.
- **DB schema:** Define tables in `lib/db/src/schema/`. Each file should export a Drizzle table, a `drizzle-zod` insert schema, and inferred types. Re-export from `src/schema/index.ts`.
- **Logging:** `pino` via `pino-http` middleware; logger instance in `artifacts/api-server/src/lib/logger.ts`.
- **TypeScript project references:** `mobile/tsconfig.json` uses project references for lib packages; `tsconfig.base.json` holds shared compiler options.
