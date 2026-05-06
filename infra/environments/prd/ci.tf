# ---------------------------------------------------------------------------
# GitHub Actions CI/CD — OIDC 認証 + デプロイロール
#
# OIDC プロバイダーはアカウントに1つ。dev 環境で作成済みのため
# data source で参照する。
# ---------------------------------------------------------------------------

data "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

# GitHub Actions が AssumeRoleWithWebIdentity できるトラストポリシー
data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # main ブランチへの push からのみ assume 可能
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:kumagaias/gakkyu-alert:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "${var.project}-github-actions-deploy-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

resource "aws_iam_role_policy" "github_actions_deploy_policy" {
  name = "${var.project}-github-actions-deploy-policy-${var.environment}"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR 認証トークン取得 (リージョン全体で1つ、リソース指定不可)
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      # ECR イメージの push
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
        ]
        Resource = [
          module.ecr_api.repository_arn,
          module.ecr_collect_closures.repository_arn,
          module.ecr_collect_sentinel.repository_arn,
          module.ecr_send_alerts.repository_arn,
        ]
      },
      # Lambda のコード更新 (イメージ URI の切り替え)
      {
        Effect = "Allow"
        Action = ["lambda:UpdateFunctionCode"]
        Resource = [
          module.lambda_api.function_arn,
          module.lambda_collect_closures.function_arn,
          module.lambda_collect_sentinel.function_arn,
          module.lambda_send_alerts.function_arn,
        ]
      },
      # Amplify ビルドのトリガー (GitHub Actions が path フィルター付きで起動)
      {
        Effect   = "Allow"
        Action   = ["amplify:ListApps"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["amplify:StartJob"]
        Resource = "arn:aws:amplify:${var.aws_region}:843925270284:apps/*/branches/*"
      },
    ]
  })
}
