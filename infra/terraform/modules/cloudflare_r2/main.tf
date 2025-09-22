resource "cloudflare_r2_bucket" "media" {
  account_id = var.account_id
  name       = "${var.environment}-${var.bucket_name}"
  location   = var.bucket_location
}

# CORS設定は後でCloudflareダッシュボードから手動設定

# Custom domain and cache rules removed for simplicity
# R2 bucket will be accessible via default R2 URL: https://<bucket-name>.<account-id>.r2.cloudflarestorage.com
