variable "environment" {
  type        = string
  description = "Deployment environment (dev, prod, etc.)."
}

variable "account_id" {
  type        = string
  description = "Cloudflare account ID."
}

variable "zone_id" {
  type        = string
  description = "Cloudflare zone ID for the custom domain."
}

variable "bucket_name" {
  type        = string
  description = "R2 bucket name." 
}

variable "bucket_location" {
  type        = string
  description = "R2 bucket geographical location (e.g. wnam, enam)."
  default     = "wnam"
}

variable "custom_domain" {
  type        = string
  description = "Custom domain to map to the R2 bucket (must exist in Cloudflare)."
}

variable "r2_access_key" {
  type        = string
  description = "Application access key ID (generated manually for now)."
  sensitive   = true
}

variable "r2_secret_key" {
  type        = string
  description = "Application access secret (generated manually for now)."
  sensitive   = true
}
