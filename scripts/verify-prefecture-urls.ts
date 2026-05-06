// 都道府県の感染症情報ページURL存在確認スクリプト
// 使い方: npx tsx scripts/verify-prefecture-urls.ts

const PREFECTURE_URLS = [
  { id: "hokkaido", name: "北海道", url: "https://www.pref.hokkaido.lg.jp/hf/kth/" },
  { id: "aomori", name: "青森県", url: "https://www.pref.aomori.lg.jp/soshiki/kenko/hoken/" },
  { id: "iwate", name: "岩手県", url: "https://www.pref.iwate.jp/" },
  { id: "miyagi", name: "宮城県", url: "https://www.pref.miyagi.jp/soshiki/hokans/" },
  { id: "akita", name: "秋田県", url: "https://www.pref.akita.lg.jp/" },
  { id: "yamagata", name: "山形県", url: "https://www.pref.yamagata.jp/" },
  { id: "fukushima", name: "福島県", url: "https://www.pref.fukushima.lg.jp/sec/21045a/" },
  { id: "ibaraki", name: "茨城県", url: "https://www.pref.ibaraki.jp/" },
  { id: "tochigi", name: "栃木県", url: "https://www.pref.tochigi.lg.jp/" },
  { id: "gunma", name: "群馬県", url: "https://www.pref.gunma.jp/" },
  { id: "saitama", name: "埼玉県", url: "https://www.pref.saitama.lg.jp/" },
  { id: "chiba", name: "千葉県", url: "https://www.pref.chiba.lg.jp/" },
  { id: "tokyo", name: "東京都", url: "https://www.hokeniryo.metro.tokyo.lg.jp/kansen/" },
  { id: "kanagawa", name: "神奈川県", url: "https://www.pref.kanagawa.jp/" },
  { id: "niigata", name: "新潟県", url: "https://www.pref.niigata.lg.jp/" },
  { id: "toyama", name: "富山県", url: "https://www.pref.toyama.jp/" },
  { id: "ishikawa", name: "石川県", url: "https://www.pref.ishikawa.lg.jp/kansen/" },
  { id: "fukui", name: "福井県", url: "https://www.pref.fukui.lg.jp/" },
  { id: "yamanashi", name: "山梨県", url: "https://www.pref.yamanashi.jp/" },
  { id: "nagano", name: "長野県", url: "https://www.pref.nagano.lg.jp/" },
  { id: "gifu", name: "岐阜県", url: "https://www.pref.gifu.lg.jp/" },
  { id: "shizuoka", name: "静岡県", url: "https://www.pref.shizuoka.jp/" },
  { id: "aichi", name: "愛知県", url: "https://www.pref.aichi.jp/" },
  { id: "mie", name: "三重県", url: "https://www.pref.mie.lg.jp/YAKUMUS/HP/m0068000066.htm" },
  { id: "shiga", name: "滋賀県", url: "https://www.pref.shiga.lg.jp/" },
  { id: "kyoto", name: "京都府", url: "https://www.pref.kyoto.jp/" },
  { id: "osaka", name: "大阪府", url: "https://www.pref.osaka.lg.jp/iryo/osakakansensho/" },
  { id: "hyogo", name: "兵庫県", url: "https://web.pref.hyogo.lg.jp/" },
  { id: "nara", name: "奈良県", url: "https://www.pref.nara.jp/1693.htm" },
  { id: "wakayama", name: "和歌山県", url: "https://www.pref.wakayama.lg.jp/prefg/041200/index.html" },
  { id: "tottori", name: "鳥取県", url: "https://www.pref.tottori.lg.jp/kansenshou/" },
  { id: "shimane", name: "島根県", url: "https://www.pref.shimane.lg.jp/" },
  { id: "okayama", name: "岡山県", url: "https://www.pref.okayama.jp/" },
  { id: "hiroshima", name: "広島県", url: "https://www.pref.hiroshima.lg.jp/soshiki/57/" },
  { id: "yamaguchi", name: "山口県", url: "https://www.pref.yamaguchi.lg.jp/soshiki/13/" },
  { id: "tokushima", name: "徳島県", url: "https://www.pref.tokushima.lg.jp/ippannokata/kenko/kansensho/" },
  { id: "kagawa", name: "香川県", url: "https://www.pref.kagawa.lg.jp/" },
  { id: "ehime", name: "愛媛県", url: "https://www.pref.ehime.jp/" },
  { id: "kochi", name: "高知県", url: "https://www.pref.kochi.lg.jp/soshiki/130401/" },
  { id: "fukuoka", name: "福岡県", url: "https://www.pref.fukuoka.lg.jp/" },
  { id: "saga", name: "佐賀県", url: "https://www.pref.saga.lg.jp/" },
  { id: "nagasaki", name: "長崎県", url: "https://www.pref.nagasaki.jp/" },
  { id: "kumamoto", name: "熊本県", url: "https://www.pref.kumamoto.jp/" },
  { id: "oita", name: "大分県", url: "https://www.pref.oita.jp/" },
  { id: "miyazaki", name: "宮崎県", url: "https://www.pref.miyazaki.lg.jp/" },
  { id: "kagoshima", name: "鹿児島県", url: "https://www.pref.kagoshima.jp/" },
  { id: "okinawa", name: "沖縄県", url: "https://www.pref.okinawa.jp/" },
];

async function checkUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("都道府県URL存在確認\n");
  
  const results = await Promise.all(
    PREFECTURE_URLS.map(async (pref) => {
      const exists = await checkUrl(pref.url);
      return { ...pref, exists };
    })
  );

  const existing = results.filter(r => r.exists);
  const missing = results.filter(r => !r.exists);

  console.log(`✅ 存在確認: ${existing.length}/${results.length}\n`);
  
  if (missing.length > 0) {
    console.log("❌ アクセスできなかったURL:");
    missing.forEach(r => console.log(`  ${r.name}: ${r.url}`));
    console.log();
  }

  console.log("\n=== 全URLリスト ===\n");
  results.forEach(r => {
    const status = r.exists ? "✅" : "❌";
    console.log(`${status} ${r.name}: ${r.url}`);
  });
}

main();
