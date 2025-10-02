# CDN用Cloudflare R2バケットのみを管理
# 既存のSupabase、Vercel、GitHub Actionsはそのまま使用

# 既存のWNAMバケット（誤って作成されたもの、内容があるため保持）
module "cloudflare_r2_wnam" {
  source = "./modules/cloudflare_r2"

  environment     = var.environment
  account_id      = var.cloudflare_account_id
  bucket_name     = var.cloudflare_r2_bucket_name
  bucket_location = "WNAM"  # 既存バケットの実際の値（大文字）を使用
}

# 新しいAPACバケット（正しいリージョン）
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

# Terraform完了後の手動設定:
# 1. ValueドメインでDNSレコードを設定:
#    - タイプ: CNAME
#    - 名前: cdn.en-ma.ster.jp.net
#    - 値: prod-lang-media-apac.d6440650d9139a91a55c362227fb9310.r2.cloudflarestorage.com
# 2. CloudflareダッシュボードでR2 Access Key/Secret Keyを作成
# 3. Vercelの環境変数に以下を追加:
#    - R2_BUCKET_NAME: (bucket name from output)
#    - R2_PUBLIC_URL: (custom domain URL)
#    - R2_ACCESS_KEY_ID: (from Cloudflare dashboard)
#    - R2_SECRET_ACCESS_KEY: (from Cloudflare dashboard)
