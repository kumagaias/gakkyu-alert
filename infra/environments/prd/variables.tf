variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prd"
}

variable "project" {
  description = "Project name"
  type        = string
  default     = "gakkyu-alert"
}

variable "github_repository_url" {
  description = "GitHub repository URL"
  type        = string
  default     = "https://github.com/kumagaias/gakkyu-alert"
}

variable "branch_name" {
  description = "Git branch to track for deployment"
  type        = string
  default     = "main"
}

variable "github_token" {
  description = "GitHub personal access token for Amplify to access the repository"
  type        = string
  sensitive   = true
}

variable "admin_token" {
  description = "Admin API token for /api/v1/admin/* endpoints"
  type        = string
  sensitive   = true
}

variable "custom_domain" {
  description = "Custom domain to associate with the Amplify app"
  type        = string
  default     = "gakkyu-alert.kumagaias.com"
}

variable "route53_zone_name" {
  description = "Route 53 hosted zone name"
  type        = string
  default     = "kumagaias.com"
}
