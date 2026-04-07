variable "app_name" {
  description = "Amplify app name"
  type        = string
}

variable "repository" {
  description = "GitHub repository URL (e.g. https://github.com/owner/repo)"
  type        = string
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
  sensitive   = true
}

variable "branch_name" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}

variable "build_spec" {
  description = "Amplify build spec YAML"
  type        = string
}

variable "environment_variables" {
  description = "Environment variables for the app"
  type        = map(string)
  default     = {}
}

variable "custom_domain" {
  description = "Custom domain to associate with the app (e.g. gakkyu-alert-dev.kumagaias.com)"
  type        = string
  default     = null
}
