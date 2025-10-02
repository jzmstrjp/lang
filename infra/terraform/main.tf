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
  bucket_location = "apac"
}

# Terraform完了後の手動設定:
# Vercelの環境変数に以下を追加:
# - R2_BUCKET_NAME: (bucket name from output)
# - R2_PUBLIC_URL: (bucket URL from output)
# - R2_ACCESS_KEY_ID: (from Cloudflare dashboard)
# - R2_SECRET_ACCESS_KEY: (from Cloudflare dashboard)
