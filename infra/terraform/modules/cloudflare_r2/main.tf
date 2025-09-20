resource "cloudflare_r2_bucket" "media" {
  account_id = var.account_id
  name       = "${var.environment}-${var.bucket_name}"
  location   = var.bucket_location
}

resource "cloudflare_r2_bucket_cors" "default" {
  account_id = var.account_id
  bucket_name = cloudflare_r2_bucket.media.name

  cors_rules {
    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}

resource "cloudflare_r2_custom_domain" "media" {
  account_id = var.account_id
  bucket_id  = cloudflare_r2_bucket.media.id
  domain     = var.custom_domain
}

# Cache rule: aggressive caching for media assets, respect existing headers
resource "cloudflare_ruleset" "r2_cache" {
  zone_id    = var.zone_id
  name       = "${var.environment}-r2-cache"
  description = "Cache settings for R2 media delivery"
  phase      = "http_request_cache_settings"

  rules {
    expression = "http.host eq \"${var.custom_domain}\""
    description = "Cache R2 media aggressively"

    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        default = 86400
      }
      browser_ttl {
        default = 600
      }
      origin_error_page_passthru = true
    }
    enabled = true
  }
}
