variable "environment" {
  type        = string
  description = "Deployment environment (dev, prod, etc.)."
}

variable "account_id" {
  type        = string
  description = "Cloudflare account ID."
}

variable "bucket_name" {
  type        = string
  description = "R2 bucket name." 
}

variable "bucket_location" {
  type        = string
  description = "R2 bucket geographical location (e.g. apac, wnam, enam)."
  default     = "apac"
}
