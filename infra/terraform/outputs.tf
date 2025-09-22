# R2バケット作成結果の出力

output "r2_bucket_name" {
  value       = module.cloudflare_r2.bucket_name
  description = "Name of the created R2 bucket."
}

output "r2_bucket_url" {
  value       = module.cloudflare_r2.bucket_public_url
  description = "Default R2 bucket public URL."
}

# 次の手動設定:
# 1. CloudflareダッシュボードでR2 Access Key/Secret Keyを作成
# 2. VercelにR2_BUCKET_NAMEとR2_PUBLIC_URLを設定
# 3. VercelにR2_ACCESS_KEY_IDとR2_SECRET_ACCESS_KEYを設定