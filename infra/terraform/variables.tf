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
  description = "Name of the R2 bucket to store generated media."
  type        = string
}

variable "cloudflare_r2_domain" {
  description = "Custom domain (e.g. media.example.com) mapped to the R2 bucket via Cloudflare."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID that hosts the custom domain."
  type        = string
}

# Supabase関連変数を削除 - 既存のSupabaseプロジェクトを使用

# Vercel、OpenAI、ElevenLabs関連の変数は削除
# これらは手動でVercelの環境変数として設定するため、Terraformでは管理しない

variable "cloudflare_r2_access_key" {
  description = "R2 access key ID for application usage."
  type        = string
  sensitive   = true
}

variable "cloudflare_r2_secret_key" {
  description = "R2 secret access key for application usage."
  type        = string
  sensitive   = true
}

# 不要な変数を削除 - 既存インフラを使用
