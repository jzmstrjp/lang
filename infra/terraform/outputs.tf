output "cloudflare_r2_bucket" {
  value = module.cloudflare_r2.bucket_name
}

output "cloudflare_r2_domain" {
  value = module.cloudflare_r2.bucket_public_domain
}

output "supabase_connection_uri" {
  value     = module.supabase_postgres.connection_uri
  sensitive = true
}

output "vercel_project_id" {
  value = module.vercel_app.project_id
}
