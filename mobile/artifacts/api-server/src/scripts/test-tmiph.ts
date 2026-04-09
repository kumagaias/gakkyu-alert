/**
 * 手動テスト: TMIPH 保健所別データ取得
 * 実行: pnpm --filter @workspace/api-server exec tsx src/scripts/test-tmiph.ts
 */

import { fetchLatestTmiphData, getIsoWeek } from "../lib/tmiph.js";

const LEVEL_THRESHOLDS = [
  { level: 3, min: 30 },
  { level: 2, min: 10 },
  { level: 1, min:  1 },
  { level: 0, min:  0 },
] as const;

function calcLevel(v: number): 0 | 1 | 2 | 3 {
  for (const { level, min } of LEVEL_THRESHOLDS) if (v >= min) return level;
  return 0;
}

const LEVEL_LABEL = ["平穏", "注意", "警戒", "流行"];

async function main() {
  const { year: curYear, week: curWeek } = getIsoWeek(new Date());
  console.log(`現在ISO週: ${curYear}-W${curWeek}\n`);

  console.log("TMIPH 保健所別データ取得中...");
  const { records, year, week } = await fetchLatestTmiphData();
  console.log(`取得完了: ${year}-W${week}  (${records.length} 保健所)\n`);

  console.log(
    "保健所名           | flu | sentinel | /sentinel | Lv | ラベル | Districts"
  );
  console.log(
    "-------------------+-----+----------+-----------+----+--------+----------"
  );

  for (const r of records) {
    const lv = calcLevel(r.fluPerSentinel);
    console.log(
      [
        r.hcName.padEnd(17),
        String(r.fluCount).padStart(5),
        String(r.fluSentinels).padStart(10),
        r.fluPerSentinel.toFixed(2).padStart(11),
        String(lv).padStart(4),
        LEVEL_LABEL[lv].padEnd(6),
        r.districtIds.join(", "),
      ].join(" | ")
    );
  }

  // 監視対象8地区のみ抜粋
  const monitored = ["nerima", "suginami", "musashino", "itabashi", "toshima", "nakano", "setagaya", "mitaka"];
  const distToHc = new Map(records.flatMap(r => r.districtIds.map(id => [id, r])));

  console.log("\n── 監視対象地区 ────────────────────────────────");
  for (const distId of monitored) {
    const rec = distToHc.get(distId);
    if (!rec) {
      console.log(`  ${distId.padEnd(12)} → 保健所データなし`);
    } else {
      const lv = calcLevel(rec.fluPerSentinel);
      console.log(
        `  ${distId.padEnd(12)} → ${rec.hcName.padEnd(8)} flu=${rec.fluPerSentinel.toFixed(2)}/定点  Lv${lv} (${LEVEL_LABEL[lv]})`
      );
    }
  }
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
