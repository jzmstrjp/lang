variable "environment" {
  type        = string
  description = "Deployment environment (dev, prod, etc.)."
}

variable "project_name" {
  type        = string
  description = "Vercel project name."
}

variable "team_id" {
  type        = string
  description = "Vercel team ID (empty for personal account)."
  default     = ""
}

variable "framework" {
  type        = string
  description = "Framework preset for Vercel deployment."
  default     = "nextjs"
}

variable "db_connection_uri" {
  type        = string
  sensitive   = true
  description = "PostgreSQL connection URI exposed as DATABASE_URL."
}

variable "cloudflare_r2_host" {
  type        = string
  description = "Public host/domain for R2 assets."
}

variable "openai_api_key" {
  type        = string
  sensitive   = true
}

variable "elevenlabs_api_key" {
  type        = string
  sensitive   = true
}

variable "r2_access_key" {
  type        = string
  sensitive   = true
}

variable "r2_secret_key" {
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Optional Supabase service role key; leave empty if not using Supabase."
}
