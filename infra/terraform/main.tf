# CDN用Cloudflare R2バケットのみを管理
# 既存のSupabase、Vercel、GitHub Actionsはそのまま使用

module "cloudflare_r2" {
  source = "./modules/cloudflare_r2"

  environment = var.environment
  account_id  = var.cloudflare_account_id
  bucket_name = var.cloudflare_r2_bucket_name
}

# Terraform完了後の手動設定:
# Vercelの環境変数に以下を追加:
# - R2_BUCKET_NAME: (bucket name from output)
# - R2_PUBLIC_URL: (bucket URL from output)
# - R2_ACCESS_KEY_ID: (from Cloudflare dashboard)
# - R2_SECRET_ACCESS_KEY: (from Cloudflare dashboard)
