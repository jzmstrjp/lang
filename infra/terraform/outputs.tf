# R2バケット作成結果の出力

# APACバケット
output "r2_bucket_name_apac" {
  value       = module.cloudflare_r2_apac.bucket_name
  description = "Name of the APAC R2 bucket."
}

output "r2_bucket_url_apac" {
  value       = module.cloudflare_r2_apac.bucket_public_url
  description = "Default APAC R2 bucket public URL."
}

output "r2_custom_domain_apac" {
  value       = cloudflare_r2_custom_domain.apac_cdn.domain
  description = "Custom domain for APAC R2 bucket."
}

# 次の手動設定:
# 1. CloudflareダッシュボードでR2 Access Key/Secret Keyを作成
# 2. VercelにR2_BUCKET_NAMEとR2_PUBLIC_URLを設定
# 3. VercelにR2_ACCESS_KEY_IDとR2_SECRET_ACCESS_KEYを設定