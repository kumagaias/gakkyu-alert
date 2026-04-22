terraform {
  required_version = "~> 1.14"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project
    }
  }
}

module "amplify" {
  source = "../../modules/amplify"

  app_name      = "${var.project}-${var.environment}"
  repository    = var.github_repository_url
  github_token  = var.github_token
  branch_name   = var.branch_name
  custom_domain = var.custom_domain

  build_spec = file("${path.module}/amplify-build-spec.yml")

  environment_variables = {
    EXPO_PUBLIC_API_BASE_URL = "https://${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
  }
}

# ---------------------------------------------------------------------------
# Route 53 — カスタムドメイン用 DNS レコード
# ---------------------------------------------------------------------------

data "aws_route53_zone" "main" {
  count = var.custom_domain != null ? 1 : 0
  name  = var.route53_zone_name
}

# ACM 証明書の DNS 検証レコード
resource "aws_route53_record" "amplify_cert_validation" {
  count           = var.custom_domain != null ? 1 : 0
  zone_id         = one(data.aws_route53_zone.main).zone_id
  name            = module.amplify.cert_validation_dns_name
  type            = "CNAME"
  ttl             = 300
  records         = [module.amplify.cert_validation_dns_value]
  allow_overwrite = true
}

# NOTE: サブドメインの A ALIAS レコード (gakkyu-alert.kumagaias.com → CloudFront) は
# aws_amplify_domain_association が自動作成するため Terraform では管理しない。

# ---------------------------------------------------------------------------
# DynamoDB テーブル
# ---------------------------------------------------------------------------

module "db_masters" {
  source      = "../../modules/aws/dynamodb"
  table_name  = "${var.project}-masters-${var.environment}"
  hash_key    = "pk"
  range_key   = "sk"
  ttl_enabled = false
}

module "db_snapshots" {
  source        = "../../modules/aws/dynamodb"
  table_name    = "${var.project}-snapshots-${var.environment}"
  hash_key      = "pk"
  range_key     = "sk"
  ttl_enabled   = true
  ttl_attribute = "ttlEpoch"
}

module "db_devices" {
  source        = "../../modules/aws/dynamodb"
  table_name    = "${var.project}-devices-${var.environment}"
  hash_key      = "pk"
  range_key     = "sk"
  ttl_enabled   = true
  ttl_attribute = "ttlEpoch"
  gsi_attributes = [
    { name = "homeDistrictId", type = "S" }
  ]
  global_secondary_indexes = [
    { name = "homeDistrict-index", hash_key = "homeDistrictId", range_key = "sk", projection_type = "ALL" }
  ]
}

module "db_schools" {
  source      = "../../modules/aws/dynamodb"
  table_name  = "${var.project}-schools-${var.environment}"
  hash_key    = "pk"
  range_key   = "sk"
  ttl_enabled = false
}

# ---------------------------------------------------------------------------
# ECR リポジトリ
# ---------------------------------------------------------------------------

module "ecr_api" {
  source          = "../../modules/aws/ecr"
  repository_name = "${var.project}-api-${var.environment}"
}

module "ecr_collect_closures" {
  source          = "../../modules/aws/ecr"
  repository_name = "${var.project}-collect-closures-${var.environment}"
}

module "ecr_collect_sentinel" {
  source          = "../../modules/aws/ecr"
  repository_name = "${var.project}-collect-sentinel-${var.environment}"
}

module "ecr_send_alerts" {
  source          = "../../modules/aws/ecr"
  repository_name = "${var.project}-send-alerts-${var.environment}"
}

# ---------------------------------------------------------------------------
# IAM ロール
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_api" {
  name               = "${var.project}-lambda-api-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role" "lambda_cron" {
  name               = "${var.project}-lambda-cron-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy" "lambda_api_policy" {
  name = "${var.project}-lambda-api-policy-${var.environment}"
  role = aws_iam_role.lambda_api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          module.db_masters.table_arn,
          module.db_snapshots.table_arn,
          module.db_devices.table_arn,
          "${module.db_devices.table_arn}/index/*",
          module.db_schools.table_arn,
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_cron_policy" {
  name = "${var.project}-lambda-cron-policy-${var.environment}"
  role = aws_iam_role.lambda_cron.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          module.db_masters.table_arn,
          module.db_snapshots.table_arn,
          module.db_schools.table_arn,
        ]
      },
      {
        # collect-sentinel が AI コメント生成に Bedrock (Amazon Nova Lite) を使用
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.nova-lite-v1:0"
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# API Gateway (REST — すべてのリクエストを Lambda にプロキシ)
# ---------------------------------------------------------------------------

resource "aws_api_gateway_rest_api" "api" {
  name        = "${var.project}-api-${var.environment}"
  description = "がっきゅうアラート API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_proxy" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_api.invoke_arn
}

resource "aws_api_gateway_deployment" "api" {
  depends_on  = [aws_api_gateway_integration.lambda_proxy]
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.proxy.id,
      aws_api_gateway_method.proxy_any.id,
      aws_api_gateway_integration.lambda_proxy.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "api" {
  deployment_id = aws_api_gateway_deployment.api.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = var.environment
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project}-${var.environment}"
  retention_in_days = 7
}

# ---------------------------------------------------------------------------
# Lambda 関数
# ---------------------------------------------------------------------------

module "lambda_api" {
  source        = "../../modules/aws/lambda"
  function_name = "${var.project}-api-${var.environment}"
  iam_role_arn  = aws_iam_role.lambda_api.arn
  image_uri     = "${module.ecr_api.repository_url}:latest"
  timeout       = 29

  create_api_gateway_permission = true
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn

  environment_variables = {
    NODE_ENV                             = var.environment
    TABLE_MASTERS                        = module.db_masters.table_name
    TABLE_SNAPSHOTS                      = module.db_snapshots.table_name
    TABLE_DEVICES                        = module.db_devices.table_name
    TABLE_SCHOOLS                        = module.db_schools.table_name
    AWS_NODEJS_CONNECTION_REUSE_ENABLED  = "1"
    ADMIN_TOKEN                          = var.admin_token
  }
}

module "lambda_collect_closures" {
  source        = "../../modules/aws/lambda"
  function_name = "${var.project}-collect-closures-${var.environment}"
  iam_role_arn  = aws_iam_role.lambda_cron.arn
  image_uri     = "${module.ecr_collect_closures.repository_url}:latest"
  timeout       = 120
  memory_size   = 256

  environment_variables = {
    NODE_ENV                            = var.environment
    TABLE_SNAPSHOTS                     = module.db_snapshots.table_name
    AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
  }
}

module "lambda_collect_sentinel" {
  source        = "../../modules/aws/lambda"
  function_name = "${var.project}-collect-sentinel-${var.environment}"
  iam_role_arn  = aws_iam_role.lambda_cron.arn
  image_uri     = "${module.ecr_collect_sentinel.repository_url}:latest"
  timeout       = 300
  memory_size   = 512

  environment_variables = {
    NODE_ENV                            = var.environment
    TABLE_SNAPSHOTS                     = module.db_snapshots.table_name
    AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
  }
}

module "lambda_send_alerts" {
  source        = "../../modules/aws/lambda"
  function_name = "${var.project}-send-alerts-${var.environment}"
  iam_role_arn  = aws_iam_role.lambda_cron.arn
  image_uri     = "${module.ecr_send_alerts.repository_url}:latest"
  timeout       = 120
  memory_size   = 256

  environment_variables = {
    NODE_ENV                            = var.environment
    TABLE_SNAPSHOTS                     = module.db_snapshots.table_name
    TABLE_DEVICES                       = module.db_devices.table_name
    AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
  }
}

# ---------------------------------------------------------------------------
# EventBridge スケジュール (JST = UTC+9)
# ---------------------------------------------------------------------------

# 毎日 6:00 JST (= 前日 21:00 UTC) — 学級閉鎖データ収集
module "cron_collect_closures" {
  source                      = "../../modules/aws/eventbridge"
  rule_name                   = "${var.project}-collect-closures-${var.environment}"
  description                 = "毎日 6:00 JST に学級閉鎖データを Tableau から取得"
  schedule_expression         = "cron(0 21 * * ? *)"
  target_lambda_arn           = module.lambda_collect_closures.function_arn
  target_lambda_function_name = module.lambda_collect_closures.function_name
}

# 毎週月曜 5:00 JST (= 日曜 20:00 UTC) — 定点把握データ収集 + AI コメント生成
module "cron_collect_sentinel" {
  source                      = "../../modules/aws/eventbridge"
  rule_name                   = "${var.project}-collect-sentinel-${var.environment}"
  description                 = "毎週月曜 5:00 JST に IDWR 定点データを取得し AI コメントを生成"
  schedule_expression         = "cron(0 20 ? * SUN *)"
  target_lambda_arn           = module.lambda_collect_sentinel.function_arn
  target_lambda_function_name = module.lambda_collect_sentinel.function_name
}

# 毎日 6:30 JST (= 前日 21:30 UTC) — Push 通知送信
module "cron_send_alerts" {
  source                      = "../../modules/aws/eventbridge"
  rule_name                   = "${var.project}-send-alerts-${var.environment}"
  description                 = "毎日 6:30 JST に Push 通知を送信"
  schedule_expression         = "cron(30 21 * * ? *)"
  target_lambda_arn           = module.lambda_send_alerts.function_arn
  target_lambda_function_name = module.lambda_send_alerts.function_name
}
