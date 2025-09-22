# CDN用Cloudflare R2バケットのみを管理
# 既存のSupabase、Vercel、GitHub Actionsはそのまま使用

module "cloudflare_r2" {
  source = "./modules/cloudflare_r2"

  environment   = var.environment
  account_id    = var.cloudflare_account_id
  zone_id       = var.cloudflare_zone_id
  bucket_name   = var.cloudflare_r2_bucket_name
  custom_domain = var.cloudflare_r2_domain
  r2_access_key = var.cloudflare_r2_access_key
  r2_secret_key = var.cloudflare_r2_secret_key
}

# Terraform完了後の手動設定:
# Vercelの環境変数に以下を追加:
# - R2_PUBLIC_URL: https://${var.cloudflare_r2_domain}
# - R2_ACCESS_KEY_ID: ${var.cloudflare_r2_access_key}
# - R2_SECRET_ACCESS_KEY: ${var.cloudflare_r2_secret_key}
