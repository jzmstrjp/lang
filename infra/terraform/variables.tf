variable "environment" {
  description = "Deployment environment identifier (e.g. dev, prod)."
  type        = string
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID where the R2 bucket will be provisioned."
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with R2 and DNS permissions."
  type        = string
  sensitive   = true
}

variable "cloudflare_r2_bucket_name" {
  description = "Name of the R2 bucket to store generated media (WNAM region)."
  type        = string
}

variable "cloudflare_r2_bucket_name_apac" {
  description = "Name of the R2 bucket to store generated media (APAC region)."
  type        = string
}

variable "cloudflare_r2_custom_domain_apac" {
  description = "Custom domain for APAC R2 bucket."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the domain."
  type        = string
}

# シンプルなR2バケット作成のみ必要な変数を定義
