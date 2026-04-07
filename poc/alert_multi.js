/**
 * がっきゅうアラート — 練馬区・杉並区・武蔵野市 同時実行版
 *
 * 確定データソース:
 *   - 学級閉鎖 (東京都・疾患別): WB_CLOSURE_PREF/1.csv ✅  (共通・1回取得)
 *   - 学校一覧: opendata.jssh.site/segment_search ✅       (区市別・並列取得)
 */

const TODAY        = new Date().toISOString().slice(0, 10);
const TODAY_NODASH = TODAY.replace(/-/g, "");

const WB_CLOSURE_PREF = "____17095533629730";
const UA   = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://public.tableau.com/views";
const JSSH = "https://opendata.jssh.site/siss/resources";

// ── 対象区市リスト ──────────────────────────────
const TARGETS = [
  { name: "練馬区",   searchName: "練馬区" },
  { name: "杉並区",   searchName: "杉並区" },
  { name: "武蔵野市", searchName: "武蔵野市" },
];

// ── 疾患定義 ────────────────────────────────────
const DISEASES = [
  { code: "1110", name: "インフルエンザA型",       shortName: "IFA",   alertThreshold: 3 },
  { code: "1120", name: "インフルエンザB型",       shortName: "IFB",   alertThreshold: 3 },
  { code: "1130", name: "インフルエンザ(その他)",  shortName: "IF?",   alertThreshold: 2 },
  { code: "0200", name: "新型コロナウイルス感染症", shortName: "COVID", alertThreshold: 5 },
];

const DIVISION_NAMES = {
  A1: "幼稚園", A2: "幼保連携型認定こども園",
  B1: "小学校", B2: "義務教育学校",
  C1: "中学校",
  D1: "高等学校", D2: "中等教育学校",
  E1: "特別支援学校",
};

// ── ユーティリティ ───────────────────────────────
function enc(s) { return encodeURIComponent(s); }

function shortDate(d) {
  if (!d) return "??";
  const p = new Date(d);
  if (isNaN(p)) return d.slice(0, 8);
  return `${String(p.getMonth()+1).padStart(2,"0")}/${String(p.getDate()).padStart(2,"0")}`;
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return JSON.parse(await res.text());
  } catch { return null; }
}

async function fetchCSVText(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function splitCSVLine(line) {
  const values = []; let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { values.push(cur); cur = ""; }
    else cur += ch;
  }
  values.push(cur); return values;
}

function parseCSV(csv) {
  const lines = csv.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()]));
  });
}

// ── データ取得 ───────────────────────────────────

// 学級閉鎖 (東京都全体・1回だけ取得)
async function fetchClosureData() {
  const results = {};
  await Promise.all(DISEASES.map(async (disease) => {
    const url = `${BASE}/${WB_CLOSURE_PREF}/1.csv?:showVizHome=no`
              + `&${enc("都道府県")}=13:${enc("東京都")}`
              + `&${enc("疾患名等")}=${enc(disease.code+":"+disease.name)}`;
    const text = await fetchCSVText(url);
    if (!text?.includes(",")) { results[disease.code] = null; return; }

    const rows        = parseCSV(text);
    const closureRows = rows.filter(r => r["Measure Names"] === "閉鎖クラス数");
    const latest      = [...closureRows]
      .sort((a,b) => new Date(b["Update Date Time"]) - new Date(a["Update Date Time"]))[0] ?? null;
    const recentRows  = [...closureRows]
      .sort((a,b) => new Date(b["Day of 表示年月日"]) - new Date(a["Day of 表示年月日"]))
      .slice(0, 7);

    results[disease.code] = { disease, latest, recentRows };
  }));
  return results;
}

// 学校リスト (区市別・並列取得)
async function fetchSchools(searchName) {
  const url = `${JSSH}/segment_search?criteria_date=${TODAY_NODASH}&school_name=${enc(searchName)}`;
  const json = await fetchJSON(url);
  if (!json?.result) return [];
  return json.result.map(s => ({
    code:     s.school_code,
    name:     s.school_name,
    address:  s.school_address,
    division: DIVISION_NAMES[s.division] ?? s.division,
    cityCode: s.city,
    lat:      parseFloat(s.latitude),
    lng:      parseFloat(s.longitude),
  }));
}

// アラート判定
function judgeAlert(closureData) {
  return Object.values(closureData)
    .filter(d => d?.latest)
    .map(d => ({ ...d, currentValue: parseInt(d.latest["Measure Values"], 10) || 0 }))
    .filter(d => d.currentValue >= d.disease.alertThreshold);
}

// ── レポート出力 ─────────────────────────────────
function printReport(targets, closureData, schoolsByTarget, alerts) {
  const D = "═".repeat(56);
  const L = "─".repeat(56);

  console.log(`\n${D}`);
  const names = targets.map(t => t.name).join("・");
  console.log(`  🏫 がっきゅうアラート — ${names}`);
  console.log(`     ${TODAY}`);
  console.log(D);

  // ── アラートサマリ ──
  if (alerts.length > 0) {
    console.log("\n  ⚠️  【アラート】東京都で学級閉鎖が増加しています");
    for (const a of alerts) {
      console.log(`     ${a.disease.name}: ${a.currentValue}クラス閉鎖 (閾値: ${a.disease.alertThreshold})`);
    }
  } else {
    console.log("\n  ✅  現在、閾値超えの学級閉鎖はありません");
  }

  // ── 東京都 学級閉鎖 (共通) ──
  console.log(`\n${L}`);
  console.log("  📊 東京都 学級閉鎖状況（疾患別）※共通");
  console.log(L);
  for (const [code, data] of Object.entries(closureData)) {
    if (!data) {
      console.log(`  ⚪ ${DISEASES.find(d=>d.code===code)?.name}: データなし`);
      continue;
    }
    const val   = parseInt(data.latest?.["Measure Values"] ?? "0", 10) || 0;
    const updAt = data.latest?.["Update Date Time"] ?? "不明";
    const trend = data.recentRows
      .map(r => `${shortDate(r["Day of 表示年月日"])}:${r["Measure Values"]}`)
      .join(", ");
    const icon = val >= data.disease.alertThreshold ? "🔴" : val > 0 ? "🟡" : "🟢";
    console.log(`  ${icon} ${data.disease.name}: ${val}クラス  更新: ${updAt}`);
    if (trend) console.log(`     直近: ${trend}`);
  }

  // ── 区市別 学校情報 ──
  console.log(`\n${L}`);
  console.log("  🏫 学校情報（JSSSHシステム）");
  console.log(L);

  for (const target of targets) {
    const schools = schoolsByTarget[target.name] ?? [];
    const byDiv   = schools.reduce((acc, s) => {
      acc[s.division] = (acc[s.division] || 0) + 1; return acc;
    }, {});
    const detail = Object.entries(byDiv).sort()
      .map(([div, cnt]) => `${div}${cnt}校`).join(" / ");
    console.log(`  【${target.name}】合計${schools.length}校  ${detail}`);
  }

  // ── リンク ──
  console.log(`\n${L}`);
  console.log("  🔗 詳細情報（Tableau公式）");
  console.log(L);
  console.log("  欠席者マップ（市区町村別・自治体指定）:");
  console.log("  https://public.tableau.com/app/profile/jssh.absence.information.mapping.service/viz/____17431182375550/1?症状区分=1");
  console.log("  欠席者マップ（市区町村別・日付指定）:");
  console.log("  https://public.tableau.com/app/profile/jssh.absence.information.mapping.service/viz/____16744382673950/1?症状区分=1");
  console.log("  学級閉鎖マップ（都道府県別）:");
  console.log("  https://public.tableau.com/app/profile/jssh.absence.information.mapping.service/viz/____17095533629730/1");

  console.log(`\n${D}`);
}

// ── メイン ───────────────────────────────────────
async function main() {
  console.log("======================================");
  console.log(`  がっきゅうアラート 同時実行版`);
  console.log(`  対象: ${TARGETS.map(t=>t.name).join("・")}`);
  console.log(`  実行日: ${TODAY}`);
  console.log("======================================");
  console.log("  データ取得中...");

  // 学級閉鎖 (共通) + 学校リスト (並列) を同時取得
  const [closureData, ...schoolResults] = await Promise.all([
    fetchClosureData(),
    ...TARGETS.map(t => fetchSchools(t.searchName)),
  ]);

  const schoolsByTarget = Object.fromEntries(
    TARGETS.map((t, i) => [t.name, schoolResults[i]])
  );

  const alerts = judgeAlert(closureData);
  printReport(TARGETS, closureData, schoolsByTarget, alerts);

  // ── JSON サマリ ──
  const summary = {
    date:    TODAY,
    targets: TARGETS.map(t => t.name),
    alerts:  alerts.map(a => ({
      disease:   a.disease.name,
      value:     a.currentValue,
      threshold: a.disease.alertThreshold,
      updatedAt: a.latest?.["Update Date Time"],
    })),
    closure: Object.fromEntries(
      Object.entries(closureData)
        .filter(([, d]) => d)
        .map(([, d]) => [d.disease.shortName, {
          value:     parseInt(d.latest?.["Measure Values"] ?? "0", 10) || 0,
          updatedAt: d.latest?.["Update Date Time"],
          trend:     d.recentRows.map(r => ({
            date:  r["Day of 表示年月日"],
            value: parseInt(r["Measure Values"], 10) || 0,
          })),
        }])
    ),
    schools: Object.fromEntries(
      TARGETS.map(t => {
        const schools = schoolsByTarget[t.name] ?? [];
        return [t.name, {
          total: schools.length,
          byDivision: schools.reduce((acc, s) => {
            acc[s.division] = (acc[s.division] || 0) + 1; return acc;
          }, {}),
        }];
      })
    ),
  };

  console.log("\n=== JSON サマリ ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(console.error);
