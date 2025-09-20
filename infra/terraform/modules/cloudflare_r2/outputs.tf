output "bucket_name" {
  value = cloudflare_r2_bucket.media.name
}

output "bucket_public_domain" {
  value = var.custom_domain
}

output "app_access_key" {
  value       = var.r2_access_key
  description = "Expose the application access key so it can be propagated to Vercel."
  sensitive   = true
}

output "app_secret_key" {
  value       = var.r2_secret_key
  description = "Expose the application secret key so it can be propagated to Vercel."
  sensitive   = true
}
