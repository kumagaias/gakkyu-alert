terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_amplify_app" "this" {
  name         = var.app_name
  repository   = var.repository
  access_token = var.github_token

  build_spec = var.build_spec

  enable_branch_auto_deletion = true

  environment_variables = var.environment_variables

  # SPA ルーティング: 静的ファイル以外はすべて index.html に書き換え
  # これにより /map/ などを直接リロードしても 404 にならない
  custom_rule {
    source = "</^[^.]+$|\\\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }
}

resource "aws_amplify_branch" "this" {
  app_id      = aws_amplify_app.this.id
  branch_name = var.branch_name

  enable_auto_build      = true
  enable_basic_auth      = var.basic_auth_credentials != null
  basic_auth_credentials = var.basic_auth_credentials
}

resource "aws_amplify_domain_association" "this" {
  count = var.custom_domain != null ? 1 : 0

  app_id      = aws_amplify_app.this.id
  domain_name = var.custom_domain

  sub_domain {
    branch_name = aws_amplify_branch.this.branch_name
    prefix      = ""
  }

  sub_domain {
    branch_name = aws_amplify_branch.this.branch_name
    prefix      = "admin"
  }

  wait_for_verification = false
}
