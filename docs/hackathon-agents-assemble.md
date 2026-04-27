# Agents Assemble ハッカソン 実装計画

ハッカソン: https://agents-assemble.devpost.com/
締め切り: 2026年5月11日（日）23:59 EDT
賞金: 総額 $25,000

---

## コンセプト

**「学校発 感染症サーベイランス MCP サーバー」**

がっきゅうアラートが持つ学級閉鎖データ（インフルエンザ・COVID 等）を FHIR 形式で標準化し、
医療 AI エージェントが利用できる MCP サーバーとして公開する。

### なぜ学校データが重要か
- 子どもは大人より先に感染する → 学校の学級閉鎖は地域流行の **2〜3日前の早期シグナル**
- 日本の学校ベース感染サーベイランスデータはグローバルに希少
- リアルタイム更新（毎日 6:00 JST に自動収集済み）

---

## 応募パス

ハッカソンの2パスを両方カバーする:

| パス | 内容 |
|---|---|
| Build the hammer | MCP サーバー（FHIR データを AI エージェントへ公開） |
| Build a superhero | A2A エージェント（サーベイランス → 分析 → 通知の連携デモ） |

---

## 技術要件の対応

| 要件 | 対応方法 |
|---|---|
| MCP | 既存 API を MCP ツールとして公開する MCP サーバーを新規実装 |
| A2A | サーベイランス・分析・通知の3エージェントをデモ実装 |
| FHIR | 既存データを FHIR R4 リソースに変換するアダプター層 |
| Prompt Opinion | AI コメント生成部分（現在 Amazon Bedrock）に組み込み |

---

## 実装スコープ

### Phase 1（コア）: MCP サーバー + FHIR 変換

**MCP ツール一覧**

```typescript
get_disease_observations(districtId, diseaseId, dateRange)
  → FHIR Bundle<Observation>  // 週次感染カウント

get_outbreak_alert_level(districtId)
  → { level: 1-4, label: "注意"|"警戒"|"流行"|"大流行" }

search_districts()
  → FHIR Bundle<Location>  // 練馬区・杉並区・武蔵野市

get_school_closure_trend(districtId, weeks)
  → FHIR Bundle<Observation>  // 学級閉鎖件数の推移

get_diagnostic_report(districtId)
  → FHIR DiagnosticReport  // 週次サマリー + AI コメント
```

**FHIR リソースマッピング**

| 既存データ | FHIR リソース |
|---|---|
| 感染カウント（週次） | `Observation` |
| 地区（練馬区 etc.） | `Location` |
| 疾患（インフルエンザA etc.） | `Condition` / `CodeableConcept` |
| 週次サマリー + AI コメント | `DiagnosticReport` |
| 学級閉鎖件数 | `Observation`（別カテゴリ） |

### Phase 2（デモ）: A2A エージェント連携

```
SurveillanceAgent
  └─ MCP で FHIR データ取得
  └─→ AnalysisAgent（アウトブレイク予測）
        └─→ NotificationAgent（がっきゅうアラート Push 通知に繋ぐ）
```

---

## 実装場所

```
mobile/
└── artifacts/
    └── mcp-server/          # 新規パッケージ (@workspace/mcp-server)
        ├── src/
        │   ├── server.ts    # MCP サーバーエントリーポイント
        │   ├── tools/       # MCP ツール定義
        │   └── fhir/        # FHIR 変換アダプター
        └── package.json
```

---

## 差別化ポイント（審査員向け）

1. **リアルデータ**: 実際に運用中のシステムからのライブデータ
2. **希少性**: 日本語圏の学校ベース感染サーベイランスは世界的に珍しい
3. **早期警報**: 病院・診療所データより2〜3日早いシグナル
4. **標準準拠**: FHIR R4 準拠により既存医療システムとの相互運用性

---

## TODO

- [ ] Prompt Opinion アカウント作成・API 確認
- [ ] FHIR R4 コーデックの選定（`fhir-kit-client` 等）
- [ ] MCP SDK 選定（`@modelcontextprotocol/sdk`）
- [ ] A2A プロトコル仕様確認
- [ ] デモ動画・Devpost 提出物の準備（締め切り5/11）
