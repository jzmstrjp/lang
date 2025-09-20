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

variable "supabase_access_token" {
  description = "Supabase personal access token for Terraform provider."
  type        = string
  sensitive   = true
}

variable "supabase_organization_slug" {
  description = "Supabase organization slug (例: my-org)。"
  type        = string
}

variable "supabase_project_name" {
  description = "作成する Supabase プロジェクト名。"
  type        = string
}

variable "supabase_region" {
  description = "Supabase プロジェクトのリージョン (例: us-east-1)。"
  type        = string
  default     = "us-east-1"
}

variable "supabase_plan" {
  description = "Supabase プラン (free, pro など)。"
  type        = string
  default     = "free"
}

variable "supabase_db_password" {
  description = "Supabase プロジェクトのデータベースパスワード。"
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Optional Vercel team ID. Leave empty if using a personal account."
  type        = string
  default     = ""
}

variable "vercel_project_name" {
  description = "Name for the Vercel project."
  type        = string
}

variable "vercel_api_token" {
  description = "Vercel API token for managing the project via Terraform."
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key to inject into Vercel environment variables."
  type        = string
  sensitive   = true
}

variable "elevenlabs_api_key" {
  description = "ElevenLabs API key for TTS."
  type        = string
  sensitive   = true
}

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

variable "supabase_service_role_key" {
  description = "Supabase service role key or database connection string (if using Supabase). Use empty string if not applicable."
  type        = string
  sensitive   = true
  default     = ""
}

variable "run_local_migrations" {
  description = "Set to true to run Prisma migrations via local-exec after provisioning (requires npm)."
  type        = bool
  default     = false
}
