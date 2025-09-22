output "bucket_name" {
  value = cloudflare_r2_bucket.media.name
  description = "R2 bucket name"
}

output "bucket_public_url" {
  value = "https://${cloudflare_r2_bucket.media.name}.${var.account_id}.r2.cloudflarestorage.com"
  description = "Default R2 bucket public URL"
}
