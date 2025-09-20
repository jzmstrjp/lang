variable "project_name" {
  type        = string
  description = "Supabase project name."
}

variable "organization_slug" {
  type        = string
  description = "Supabase organization slug."
}

variable "region" {
  type        = string
  description = "Supabase region (e.g. us-east-1)."
}

variable "plan" {
  type        = string
  description = "Supabase plan (free, pro, etc.)."
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Database password for the default postgres user."
}
