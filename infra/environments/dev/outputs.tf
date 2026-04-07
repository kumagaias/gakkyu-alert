output "amplify_app_id" {
  description = "Amplify app ID"
  value       = module.amplify.app_id
}

output "amplify_url" {
  description = "URL of the deployed dev environment (Amplify default domain)"
  value       = module.amplify.app_url
}

output "custom_domain_url" {
  description = "Custom domain URL"
  value       = var.custom_domain != null ? "https://${var.custom_domain}" : null
}

output "api_gateway_url" {
  description = "API Gateway のエンドポイント URL"
  value       = "${aws_api_gateway_stage.api.invoke_url}"
}

output "lambda_api_name" {
  description = "API Lambda 関数名"
  value       = module.lambda_api.function_name
}

output "lambda_collect_closures_name" {
  description = "学級閉鎖収集 Lambda 関数名"
  value       = module.lambda_collect_closures.function_name
}

output "lambda_collect_sentinel_name" {
  description = "定点把握収集 Lambda 関数名"
  value       = module.lambda_collect_sentinel.function_name
}

output "ecr_api_url" {
  description = "API Lambda の ECR リポジトリ URL"
  value       = module.ecr_api.repository_url
}

output "ecr_collect_closures_url" {
  description = "学級閉鎖収集 Lambda の ECR リポジトリ URL"
  value       = module.ecr_collect_closures.repository_url
}

output "ecr_collect_sentinel_url" {
  description = "定点把握収集 Lambda の ECR リポジトリ URL"
  value       = module.ecr_collect_sentinel.repository_url
}

output "ecr_send_alerts_url" {
  description = "通知送信 Lambda の ECR リポジトリ URL"
  value       = module.ecr_send_alerts.repository_url
}

output "ci_deploy_role_arn" {
  description = "GitHub Actions が AssumeRole する IAM ロール ARN (AWS_DEPLOY_ROLE_ARN に設定)"
  value       = aws_iam_role.github_actions_deploy.arn
}
