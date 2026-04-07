variable "rule_name" {
  description = "EventBridge ルール名"
  type        = string
}

variable "description" {
  description = "ルールの説明"
  type        = string
  default     = ""
}

variable "schedule_expression" {
  description = "スケジュール式 (rate() または cron())"
  type        = string
}

variable "is_enabled" {
  description = "ルール有効化フラグ"
  type        = bool
  default     = true
}

variable "target_lambda_arn" {
  description = "対象 Lambda 関数 ARN"
  type        = string
}

variable "target_lambda_function_name" {
  description = "対象 Lambda 関数名"
  type        = string
}
