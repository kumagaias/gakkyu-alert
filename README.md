# がっきゅうアラート

学級閉鎖・感染症サーベイランスデータを可視化するモバイルアプリ

## 概要

- **データソース**: 東京都 Tableau Public、IDWR（感染症発生動向調査）、東京都保健所別データ
- **更新頻度**: 毎日 6:00 JST（学級閉鎖）、毎週月曜 5:00 JST（定点サーベイランス）
- **AI コメント**: Amazon Bedrock (Nova Lite) による週次サマリー生成

## 技術スタック

- **Frontend**: React Native (Expo)
- **Backend**: Express.js on AWS Lambda (Container)
- **Infrastructure**: Terraform, AWS (Lambda, DynamoDB, API Gateway, ECR, EventBridge)
- **CI/CD**: GitHub Actions (OIDC)

## 開発環境

### 必須ツール

```bash
# mise でツールバージョン管理
mise install  # .tool-versions に基づいてインストール
```

- Node.js 24.14.0 (LTS)
- Terraform 1.14.9
- pnpm (corepack経由)

### セットアップ

```bash
# 依存関係インストール
cd mobile
pnpm install

# 開発サーバー起動
pnpm --filter @workspace/api-server dev
```

## デプロイ

### 自動デプロイ (推奨)

`dev` または `main` ブランチへの push で自動デプロイ:

```bash
git push origin dev   # dev 環境
git push origin main  # prd 環境
```

GitHub Actions が以下を実行:
1. Docker イメージビルド (4種類の Lambda 関数)
2. ECR へ push
3. Lambda 関数コード更新

### 手動デプロイ

```bash
# インフラ (初回のみ)
cd infra/environments/dev
terraform init
terraform apply

# Lambda 関数は GitHub Actions 経由を推奨
```

## アーキテクチャ

```
┌─────────────┐
│ React Native│
│   (Expo)    │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────┐
│  API Gateway    │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Lambda (Container)              │
│  - api (Express.js)              │
│  - collect-closures (Cron)       │
│  - collect-sentinel (Cron + AI)  │
│  - send-alerts (Cron)            │
└────────┬─────────────────────────┘
         │
         ▼
┌─────────────────┐
│   DynamoDB      │
│  - snapshots    │
│  - schools      │
│  - devices      │
│  - masters      │
└─────────────────┘
```

## Bedrock API スロットリング対策

定点サーベイランスバッチ (`collect-sentinel`) で AI コメント生成時にスロットリングが発生する問題に対応:

- **並列実行制限**: p-limit で同時実行数を3に制限
- **リトライロジック**: exponential backoff (最大3回)
- **リクエスト間隔**: 1500ms

実装: `mobile/artifacts/api-server/src/cron/collect-sentinel.ts`

## ライセンス

MIT
