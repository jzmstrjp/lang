# R2のみの出力 - 既存インフラは手動管理

output "r2_bucket_name" {
  value       = module.cloudflare_r2.bucket_name
  description = "Name of the created R2 bucket."
}

output "r2_public_domain" {
  value       = module.cloudflare_r2.bucket_public_domain  
  description = "Public domain for accessing R2 assets."
}

output "r2_access_credentials" {
  value = {
    access_key_id     = module.cloudflare_r2.app_access_key
    secret_access_key = module.cloudflare_r2.app_secret_key
    public_url        = "https://${module.cloudflare_r2.bucket_public_domain}"
  }
  description = "R2 credentials and public URL for manual Vercel environment variable setup."
  sensitive   = true
}