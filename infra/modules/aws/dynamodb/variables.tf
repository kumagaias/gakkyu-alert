variable "table_name" {
  description = "DynamoDB テーブル名"
  type        = string
}

variable "hash_key" {
  description = "ハッシュキー属性名"
  type        = string
}

variable "range_key" {
  description = "レンジキー属性名"
  type        = string
  default     = null
}

variable "ttl_enabled" {
  description = "TTL 有効化"
  type        = bool
  default     = true
}

variable "ttl_attribute" {
  description = "TTL 属性名"
  type        = string
  default     = "ttlEpoch"
}

variable "point_in_time_recovery" {
  description = "ポイントインタイムリカバリ有効化"
  type        = bool
  default     = false
}

variable "gsi_attributes" {
  description = "GSI 用追加属性（PK/SK 以外）"
  type = list(object({
    name = string
    type = string
  }))
  default = []
}

variable "global_secondary_indexes" {
  description = "グローバルセカンダリインデックス定義"
  type = list(object({
    name            = string
    hash_key        = string
    range_key       = optional(string)
    projection_type = string
  }))
  default = []
}
