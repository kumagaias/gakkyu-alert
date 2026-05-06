# 運用ガイド

## デプロイ

### 自動デプロイ (推奨)

`develop` または `main` ブランチへの push で自動デプロイ:

```bash
git push origin develop  # dev 環境
git push origin main     # prd 環境
```

GitHub Actions が実行:
1. Docker イメージビルド (4種類の Lambda 関数)
2. ECR へ push
3. Lambda 関数コード更新

### 対象ファイル

以下のファイル変更時に自動デプロイ:
- `mobile/artifacts/api-server/**`
- `mobile/lib/**`
- `mobile/Dockerfile`
- `mobile/pnpm-lock.yaml`

## バッチジョブ

### 学級閉鎖データ収集 (`collect-closures`)
- **スケジュール**: 毎日 6:00 JST
- **処理**: Tableau Public から学級閉鎖データを取得
- **保存先**: DynamoDB `snapshots` テーブル

### 定点サーベイランスデータ収集 (`collect-sentinel`)
- **スケジュール**: 毎週月曜 5:00 JST
- **処理**: 
  - IDWR から全国の定点データを取得
  - 東京都保健所別データを取得
  - Amazon Bedrock (Nova Lite) で AI コメント生成
- **保存先**: DynamoDB `snapshots` テーブル
- **スロットリング対策**: 
  - 並列実行数を3に制限 (p-limit)
  - exponential backoff リトライ (最大3回)
  - リクエスト間隔 1500ms

### Push 通知送信 (`send-alerts`)
- **スケジュール**: 毎日 6:30 JST
- **処理**: 登録デバイスに Push 通知を送信

## トラブルシューティング

### Bedrock スロットリングエラー

**症状**: `ThrottlingException: Too many requests`

**対策済み** (2026-04-29):
- 並列実行数を全体で3に制限
- exponential backoff リトライロジック追加
- リクエスト間隔を1500msに延長

**確認方法**:
```bash
# CloudWatch Logs で確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/gakkyu-alert-collect-sentinel-dev \
  --filter-pattern "ThrottlingException" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

### Lambda タイムアウト

**症状**: Lambda 関数がタイムアウト

**確認方法**:
```bash
# Lambda 関数の設定確認
aws lambda get-function-configuration \
  --function-name gakkyu-alert-collect-sentinel-dev \
  --query 'Timeout'
```

**対策**:
- `collect-sentinel`: タイムアウト 300秒 (5分)
- 必要に応じて Terraform で調整

## モニタリング

### CloudWatch Logs

```bash
# 最新のログを確認
aws logs tail /aws/lambda/gakkyu-alert-collect-sentinel-dev --follow

# エラーログのみ抽出
aws logs filter-log-events \
  --log-group-name /aws/lambda/gakkyu-alert-collect-sentinel-dev \
  --filter-pattern "ERROR"
```

### Lambda メトリクス

- Duration: 実行時間
- Errors: エラー数
- Throttles: スロットリング数
- ConcurrentExecutions: 同時実行数

## 環境変数

### dev 環境

- `NODE_ENV`: `dev`
- `TABLE_SNAPSHOTS`: `gakkyu-alert-snapshots-dev`
- `TABLE_SCHOOLS`: `gakkyu-alert-schools-dev`
- `TABLE_DEVICES`: `gakkyu-alert-devices-dev`
- `TABLE_MASTERS`: `gakkyu-alert-masters-dev`

### prd 環境

- `NODE_ENV`: `prd`
- `TABLE_SNAPSHOTS`: `gakkyu-alert-snapshots-prd`
- `TABLE_SCHOOLS`: `gakkyu-alert-schools-prd`
- `TABLE_DEVICES`: `gakkyu-alert-devices-prd`
- `TABLE_MASTERS`: `gakkyu-alert-masters-prd`
