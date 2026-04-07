// Terraform 初回 apply 用プレースホルダー
// 実際のコードは CI/CD パイプラインで deploy する
exports.handler = async (event) => {
  return {
    statusCode: 503,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "デプロイ準備中" }),
  };
};
