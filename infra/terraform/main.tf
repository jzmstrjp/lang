# CDN用Cloudflare R2バケットのみを管理
# 既存のSupabase、Vercel、GitHub Actionsはそのまま使用

# APACバケット（正しいリージョン）
module "cloudflare_r2_apac" {
  source = "./modules/cloudflare_r2"

  environment     = var.environment
  account_id      = var.cloudflare_account_id
  bucket_name     = var.cloudflare_r2_bucket_name_apac
  bucket_location = "APAC"  # 既存バケットの実際の値（大文字）を使用
}

# APACバケット用カスタムドメイン
resource "cloudflare_r2_custom_domain" "apac_cdn" {
  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  bucket_name = module.cloudflare_r2_apac.bucket_name
  domain      = var.cloudflare_r2_custom_domain_apac
  enabled     = true
}

