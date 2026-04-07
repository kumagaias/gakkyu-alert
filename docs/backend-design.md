# バックエンド設計書 v2

がっきゅうアラート — API Gateway + Lambda + DynamoDB 構成

---

## 1. 全体アーキテクチャ

```
Mobile/Web App (Expo)
└─ CloudFront (Amplify)
        │  HTTPS /api/*
        ▼
   API Gateway (REST)
        │
        ▼
   Lambda (API)          Lambda (Cron: collect-closures)  ← EventBridge 毎日 6:00 JST
   Lambda (API)          Lambda (Cron: collect-sentinel)  ← EventBridge 毎週月曜 5:00 JST
                         Lambda (Cron: send-alerts)       ← EventBridge 毎日 6:30 JST
        │                        │
        └──────────────┬──────────┘
                       ▼
                  DynamoDB テーブル群
                       │
                  ┌────┴────┐
              Tableau CSV  JSSH API  IDSC (スクレイピング)  Claude API  FCM (Push)
```

---

## 2. データソース — 全量精査

### 現状のモックデータと実データの対応

アプリ全画面を精査した結果、以下の通りモックと実データを整理する。

| データ | 表示箇所 | 現状 | 実データソース |
|---|---|---|---|
| 学級閉鎖クラス数（疾患別） | SchoolClosureCard, SchoolClosureModal | **モック** | Tableau CSV ✅ |
| 学級閉鎖 週8週推移 | SchoolClosureCard, SchoolClosureModal | **モック** | Tableau CSV ✅ |
| 定点あたり患者数（疾患別） | DiseaseModal | **モック** | IDSC 週報スクレイピング ⚠️ |
| 疾患別流行レベル（0〜3） | DiseaseRow, DiseaseModal, EpidemicLevelCard | **モック** | 定点患者数から計算 ⚠️ |
| 疾患別週推移（8週） | DiseaseModal | **モック** | IDSC 週報スクレイピング ⚠️ |
| 疾患別 AI コメント | DiseaseModal | **モック** | Claude API 生成 ⚠️ |
| 区市別流行レベル（0〜3） | マップ, DistrictModal | **モック** | 疾患レベルから近似 ⚠️ |
| 区市別 AI サマリー | EpidemicLevelCard, DistrictModal | **モック** | Claude API 生成 ⚠️ |
| 疾患マスタ（出席停止基準） | DiseaseModal | **モック** | 静的マスタ（DB 初期投入） ✅ |
| 区市マスタ | 設定, マップ | **モック** | 静的マスタ（DB 初期投入） ✅ |
| 学校リスト | SchoolClosureModal（Map link） | 未使用 | JSSH API ✅ |

### 2-1. 学級閉鎖データ（Tableau CSV）

**URL:**
```
https://public.tableau.com/views/____17095533629730/1.csv
  ?:showVizHome=no&都道府県=13:東京都&疾患名等=<code>:<name>
```

**対象疾患（PoC 実証済み）:**

| code | 疾患ID | アラート閾値 |
|---|---|---|
| 1110 | flu-a | 3クラス |
| 1120 | flu-b | 3クラス |
| 1130 | flu-other | 2クラス |
| 0200 | covid | 5クラス |

> **制約:** 東京都全体値のみ。区市別内訳なし（アプリの注釈と一致）。

### 2-2. 定点患者数（IDSC 週報）⚠️ 要実装確認

**候補 URL（要検証）:**
```
https://idsc.tmiph.metro.tokyo.lg.jp/diseases/influ/influ-wkly/
  → 週次インフルエンザ報告（HTML テーブル）

https://www.niid.go.jp/niid/ja/flu-m/2212-nih/influ-top/2074-idsc-flu.html
  → 全国定点患者数（HTML）
```

**アプリで使用するデータ:**
- `currentCount` — 定点あたり患者数（今週）
- `lastWeekCount` — 先週値
- `twoWeeksAgoCount` — 2週前値
- `weeklyHistory[8]` — 8週間推移
- `currentLevel` — 0〜3（閾値: 0未満→0, 1未満→1, 10未満→2, 10以上→3、要調整）

**対象疾患（アプリ全15疾患）:**

| 疾患ID | 疾患名 | IDSC で取得可能か |
|---|---|---|
| flu-a | インフルエンザA型 | ✅ |
| flu-b | インフルエンザB型 | ✅ |
| flu-other | インフルエンザ(その他) | ✅ |
| covid | 新型コロナウイルス | ✅ |
| noro | ノロウイルス | △（胃腸炎として集計）|
| rsv | RSウイルス | ✅ |
| strep | 溶連菌感染症 | ✅ |
| mycoplasma | マイコプラズマ肺炎 | ✅ |
| hand-foot | 手足口病 | ✅ |
| mumps | おたふくかぜ | ✅ |
| chickenpox | 水痘 | ✅ |
| measles | 麻疹 | ✅ |
| rubella | 風疹 | ✅ |
| pertussis | 百日咳 | ✅ |
| adeno | 咽頭結膜熱 | ✅ |
| gastro | 感染性胃腸炎 | △（ノロと合算の場合あり）|
| herpangina | ヘルパンギーナ | ✅ |

> **⚠️ 実装前に IDSC のページ構造を確認して HTML パースの可否を検証する必要あり。**
> 取得できない疾患はフォールバック値（モック）を継続使用。

### 2-3. 区市別流行レベル（近似計算）

区市別の定点データは行政単位の公開データが存在しない。  
以下の方法で近似する:

```
区市レベル = 疾患別レベルの最大値
区市 AI サマリー = Claude API で生成（疾患データを入力）
```

> 将来的に東京都が区市別オープンデータを公開した場合に置き換える。

### 2-4. AI コメント生成（Claude API）

**生成タイミング:** 週次 cron（`collect-sentinel` ジョブ）の完了後  
**対象:**
- 疾患別 `aiComment`（15疾患 × 1文）
- 区市別 `aiSummary`（最大 62 区市 × 1〜2文）

**Claude API 入力例（疾患コメント）:**
```json
{
  "disease": "インフルエンザA型",
  "currentCount": 18.4,
  "lastWeekCount": 12.1,
  "twoWeeksAgoCount": 7.3,
  "level": 3,
  "trend": "急増"
}
```

### 2-5. 学校リスト（JSSH API）

```
https://opendata.jssh.site/siss/resources/segment_search
  ?criteria_date=<YYYYMMDD>&school_name=<区市名>
```

取得後は `schools` DynamoDB テーブルに保存（週次更新）。  
アプリ現在は学校リストを UI 表示していないが、将来の学校別アラート機能のために保持。

---

## 3. DynamoDB テーブル設計

### テーブル一覧

| テーブル名 | 用途 | 更新頻度 |
|---|---|---|
| `gakkyu-masters` | 区市・疾患マスタ（静的） | 月次以下 |
| `gakkyu-snapshots` | 流行データスナップショット | 日次・週次 |
| `gakkyu-devices` | Push 通知デバイス | ユーザー操作時 |
| `gakkyu-schools` | 学校リスト | 週次 |

### 3-1. `gakkyu-masters` — マスタデータ

```
PK (String)          SK (String)     項目
─────────────────────────────────────────────────────────
DISTRICT             nerima          name, searchName, prefecture
DISTRICT             suginami        ...
DISTRICT             musashino       ...
DISEASE              flu-a           name, nameEn, tableauCode, alertThreshold,
                                     schoolRules{hoikuen,shogakko,chugakko},
                                     doctorClearance, sortOrder
DISEASE              noro            ...
```

**アクセスパターン:**
- `Query PK=DISTRICT` → 全区市一覧取得（設定画面・マップ）
- `Query PK=DISEASE` → 全疾患マスタ取得
- `GetItem PK=DISTRICT, SK=nerima` → 特定区市取得

**初期データ:** 62区市 + 17疾患（`constants/data.ts` から seed）

### 3-2. `gakkyu-snapshots` — 流行スナップショット

```
PK (String)              SK (String)     項目
────────────────────────────────────────────────────────────────────
CLOSURE                  2026-04-05      entries[ {diseaseId, closedClasses,
                                           weeklyHistory[8], sourceUpdatedAt} ]
                                         updatedAt, sourceUrl

DISEASE_STATUS           2026-W14        diseases[ {id, currentCount, lastWeekCount,
                                           twoWeeksAgoCount, weeklyHistory[8],
                                           level, aiComment} ]
                                         generatedAt

DISTRICT_STATUS          2026-W14        districts[ {id, level, aiSummary} ]
                                         generatedAt
```

**アクセスパターン:**
- `GetItem PK=CLOSURE, SK=<最新日>` → 学級閉鎖データ取得
- `GetItem PK=DISEASE_STATUS, SK=<最新週>` → 疾患別流行データ取得
- `GetItem PK=DISTRICT_STATUS, SK=<最新週>` → 区市別レベル取得

**取得方法（「最新」の効率的な取得）:**
- `Query PK=CLOSURE, ScanIndexForward=false, Limit=1` → 最新1件

**TTL:** 90日後に自動削除（`ttlEpoch` 属性に Unix タイムスタンプ設定）

### 3-3. `gakkyu-devices` — Push デバイス

```
PK (String)    SK (String)     項目
─────────────────────────────────────────────────────────────────
DEVICE         <fcmToken>      platform, homeDistrictId,
                               extraDistrictIds (StringSet),
                               alertLevel (2|3),
                               weeklyEnabled, weeklyDay, weeklyHour,
                               createdAt, updatedAt
```

**GSI: `homeDistrict-index`**
```
GSI PK: homeDistrictId
GSI SK: fcmToken
```
→ 区市別に通知対象デバイスを取得するため。

**アクセスパターン:**
- `PutItem PK=DEVICE, SK=<token>` — デバイス登録/更新
- `DeleteItem PK=DEVICE, SK=<token>` — デバイス解除
- `Query GSI homeDistrictId=nerima` — 練馬区ユーザーへの通知送信

### 3-4. `gakkyu-schools` — 学校リスト

```
PK (String)              SK (String)       項目
────────────────────────────────────────────────────────────────
SCHOOL#nerima            13120001          name, address, division,
                                           lat, lng, updatedAt
SCHOOL#suginami          13220001          ...
```

**アクセスパターン:**
- `Query PK=SCHOOL#nerima` → 練馬区の全学校取得

---

## 4. API エンドポイント

ベース URL: `https://api.gakkyu-alert.kumagaias.com`（または API Gateway デフォルト URL）

| Method | Path | 説明 | Lambda |
|---|---|---|---|
| `GET` | `/healthz` | ヘルスチェック | api |
| `GET` | `/v1/status` | **メインデータ** — 学級閉鎖 + 疾患レベル + 区市レベル | api |
| `GET` | `/v1/districts` | 区市マスタ一覧 | api |
| `GET` | `/v1/schools` | 学校リスト（`?districtId=` 必須） | api |
| `POST` | `/v1/devices` | デバイス登録 / 設定同期（アップサート） | api |
| `DELETE` | `/v1/devices/{fcmToken}` | デバイス解除 | api |

### 4-1. `GET /v1/status`

アプリ起動時に1回呼び出す。ホーム画面・マップ・疾患詳細で使うデータをまとめて返す。  
CloudFront でキャッシュ（TTL: 1時間）することで Lambda 呼び出しを最小化する。

**Response:**
```jsonc
{
  "asOf": "2026-04-05T06:00:00+09:00",

  // 学級閉鎖（東京都全体・疾患別） SchoolClosureCard + Modal で使用
  "schoolClosures": {
    "lastUpdated": "2026-04-05",
    "sourceUrl": "https://www.fukushihoken.metro.tokyo.lg.jp/...",
    "tableauUrl": "https://public.tableau.com/...",
    "entries": [
      {
        "diseaseId": "flu-a",
        "diseaseName": "インフルエンザA型",
        "closedClasses": 1,       // 今週
        "weekAgoClasses": 1,      // 先週
        "weeklyHistory": [0, 0, 1, 2, 3, 2, 1, 1]  // 8週 oldest→newest
      }
      // ... 4疾患分（Tableau対象のみ）
    ]
  },

  // 疾患別流行状況（全15疾患） DiseaseRow + DiseaseModal で使用
  "diseases": [
    {
      "id": "flu-a",
      "name": "インフルエンザA型",
      "level": 3,                 // 0〜3
      "currentCount": 18.4,       // 定点あたり患者数
      "lastWeekCount": 12.1,
      "twoWeeksAgoCount": 7.3,
      "weeklyHistory": [2.1, 3.4, 5.0, 7.3, 12.1, 18.4, 18.4, 18.4],
      "aiComment": "今週は急激な増加傾向..."
    }
    // ... 15疾患分
  ],

  // 区市別レベル（全62区市） マップ + DistrictModal で使用
  "districts": [
    {
      "id": "nerima",
      "name": "練馬区",
      "level": 2,
      "aiSummary": "インフルエンザA型が警戒レベル..."
    }
    // ... 62区市分
  ]
}
```

**キャッシュ戦略:**
- API Gateway + CloudFront キャッシュ: TTL 1時間
- ETag でクライアントキャッシュ対応
- cron 完了後に CloudFront キャッシュをインバリデート

**レスポンスサイズ試算:** ≈ 30〜50KB（gzip後 8〜15KB）

### 4-2. `GET /v1/districts`

設定画面・オンボーディングの区市ピッカーで使用するマスタ一覧。  
静的データなので TTL 24時間でキャッシュ。

**Response:**
```jsonc
{
  "districts": [
    { "id": "nerima", "name": "練馬区" },
    { "id": "suginami", "name": "杉並区" }
    // ... 62区市
  ]
}
```

### 4-3. `GET /v1/schools?districtId=nerima`

**Response:**
```jsonc
{
  "districtId": "nerima",
  "districtName": "練馬区",
  "total": 82,
  "byDivision": { "幼稚園": 12, "小学校": 42, "中学校": 18 },
  "schools": [
    {
      "schoolCode": "13120001",
      "name": "練馬区立練馬小学校",
      "address": "東京都練馬区...",
      "division": "B1",
      "lat": 35.735,
      "lng": 139.651
    }
  ]
}
```

### 4-4. `POST /v1/devices`

AppContext の state が変わるたびに呼び出す（デバウンス: 2秒）。

**Request:**
```jsonc
{
  "fcmToken": "eGx...",
  "platform": "ios",                      // "ios" | "android" | "web"
  "homeDistrictId": "nerima",
  "extraDistrictIds": ["suginami"],
  "alertLevel": 2,                        // 2=警戒以上, 3=流行のみ
  "weeklyEnabled": true,
  "weeklyDay": 1,                         // 0=日〜6=土
  "weeklyHour": 7
}
```

**Response:** `200 OK`
```jsonc
{ "ok": true }
```

### 4-5. `DELETE /v1/devices/{fcmToken}`

**Response:** `200 OK`

---

## 5. Lambda 構成

### Lambda 一覧

| 関数名 | トリガー | 処理内容 | 実行時間上限 |
|---|---|---|---|
| `gakkyu-api` | API Gateway | v1/* エンドポイント処理 | 10秒 |
| `gakkyu-collect-closures` | EventBridge (毎日 6:00 JST) | Tableau CSV → DynamoDB | 5分 |
| `gakkyu-collect-sentinel` | EventBridge (毎週月曜 5:00 JST) | IDSC スクレイピング + Claude AI コメント → DynamoDB | 10分 |
| `gakkyu-send-alerts` | EventBridge (毎日 6:30 JST) | アラート判定 + FCM 送信 | 5分 |

### 5-1. `gakkyu-collect-closures` フロー

```
1. 疾患コードリスト（4疾患）を並列で Tableau CSV 取得
2. CSV パース → 疾患別 closedClasses + 8週推移を抽出
3. DynamoDB gakkyu-snapshots に Put
   PK=CLOSURE, SK=today, TTL=today+90日
4. CloudFront キャッシュをインバリデート（/v1/status）
5. 閾値超えがあれば gakkyu-send-alerts を EventBridge で即時起動
```

### 5-2. `gakkyu-collect-sentinel` フロー（週次）

```
1. IDSC HTML から疾患別定点患者数をパース（全17疾患）
2. 疾患別 level 計算（定点患者数 → 0〜3）
3. Claude API 呼び出し → 疾患別 aiComment 生成（15件）
4. 区市別 level 計算（疾患レベルの最大値）
5. Claude API 呼び出し → 区市別 aiSummary 生成（62件）
   ※ バッチ処理。1回のプロンプトで複数区市を生成
6. DynamoDB に Put
   PK=DISEASE_STATUS, SK=<ISO week>
   PK=DISTRICT_STATUS, SK=<ISO week>
7. CloudFront キャッシュをインバリデート
```

### 5-3. `gakkyu-send-alerts` フロー

```
1. DynamoDB から最新 CLOSURE スナップショット取得
2. 疾患ごとに closedClasses >= alertThreshold チェック
3. 当日既に送信済みか alert_logs（DynamoDB に記録）で確認 → 重複送止
4. 対象デバイスを homeDistrictId で GSI Query
   + extraDistrictIds に該当デバイスも追加
5. alertLevel フィルタ（疾患レベル >= デバイスの alertLevel）
6. FCM バッチ送信（500件/バッチ）
7. 送信済みを ALERT_LOG として Put
```

---

## 6. Push 通知

### プロバイダー: Firebase Cloud Messaging (FCM v1 API)

- iOS / Android / Web を統一
- Expo `expo-notifications` → FCM トークン取得
- `POST https://fcm.googleapis.com/v1/projects/<project>/messages:send`

### 通知ペイロード例

```json
{
  "title": "⚠️ 学級閉鎖が増加しています",
  "body": "インフルエンザA型: 東京都全体で5クラス閉鎖（先週比 +2）",
  "data": {
    "type": "alert",
    "diseaseId": "flu-a",
    "closedClasses": "5"
  }
}
```

---

## 7. インフラ（Terraform）

既存 `infra/` に追加する構成要素:

```
infra/modules/
├── amplify/          # 既存
└── api/              # 新規
    ├── api_gateway.tf
    ├── lambda.tf
    ├── dynamodb.tf
    ├── eventbridge.tf
    ├── iam.tf
    └── variables.tf

infra/environments/dev/
├── main.tf           # api モジュール追加
└── ...
```

### Lambda ランタイム

- Runtime: `nodejs22.x`
- esbuild でバンドル（ワークスペースの既存ビルド設定を流用）

### 環境変数

```
DYNAMODB_TABLE_MASTERS    gakkyu-masters
DYNAMODB_TABLE_SNAPSHOTS  gakkyu-snapshots
DYNAMODB_TABLE_DEVICES    gakkyu-devices
DYNAMODB_TABLE_SCHOOLS    gakkyu-schools
TABLEAU_WB_ID             ____17095533629730
CLAUDE_API_KEY            <secret>
FIREBASE_SA_KEY           <base64 JSON>
CLOUDFRONT_DISTRIBUTION_ID <id>   # キャッシュインバリデート用
```

---

## 8. 実装ロードマップ

### Phase 1 — 学級閉鎖のみ実データ化（2〜3日）

1. DynamoDB 4テーブル作成（Terraform）
2. 区市マスタ・疾患マスタ seed
3. `gakkyu-collect-closures` Lambda 実装
4. `GET /v1/status` Lambda 実装（schoolClosures のみ実データ、diseases/districts はモック継続）
5. アプリ: `SchoolClosureCard` を API に差し替え
6. 疾患マスタ（schoolRules 等）を API から取得に変更

### Phase 2 — 疾患別定点患者数（1〜2週間）

1. IDSC HTML パース実装・検証
2. `gakkyu-collect-sentinel` Lambda 実装
3. Claude API 連携（aiComment, aiSummary 生成）
4. `GET /v1/status` の diseases / districts を実データに切り替え
5. アプリ: `DiseaseModal`, `EpidemicLevelCard` を API に差し替え

### Phase 3 — Push 通知

1. `gakkyu-devices` テーブル + `POST /v1/devices` 実装
2. アプリ: `expo-notifications` 統合、設定変更時に API 同期
3. `gakkyu-send-alerts` Lambda 実装
4. 週次サマリー通知

---

## 9. 未確定事項

| 項目 | 優先度 | 備考 |
|---|---|---|
| IDSC HTML パース可否の検証 | **高** | Phase 2 の前提。パース不可なら代替案要検討 |
| Tableau CSV エンドポイントの安定性 | **高** | 非公式 API のためレート制限・変更リスクあり |
| Claude API コスト見積もり | **中** | 週次15疾患 + 62区市 = 約80プロンプト/週 |
| API Gateway カスタムドメイン設定 | **中** | `api.gakkyu-alert.kumagaias.com` |
| FCM プロジェクト作成 | **中** | Firebase Console で作成が必要 |
| IDSC で取得できない疾患のフォールバック | **低** | 初期はモック継続 |
