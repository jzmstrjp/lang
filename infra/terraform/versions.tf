terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.38.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = ">= 0.15.1"
    }
    supabase = {
      source  = "supabase/supabase"
      version = ">= 1.0.0"
    }
  }
}
