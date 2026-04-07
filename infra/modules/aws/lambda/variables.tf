variable "function_name" {
  description = "Lambda 関数名"
  type        = string
}

variable "iam_role_arn" {
  description = "Lambda 実行ロール ARN"
  type        = string
}

variable "image_uri" {
  description = "ECR コンテナイメージ URI"
  type        = string
}

variable "memory_size" {
  description = "メモリサイズ (MB)"
  type        = number
  default     = 256
}

variable "timeout" {
  description = "タイムアウト (秒)"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "環境変数"
  type        = map(string)
  default     = {}
}

variable "api_gateway_execution_arn" {
  description = "API Gateway 実行 ARN (空の場合は権限付与なし)"
  type        = string
  default     = ""
}
