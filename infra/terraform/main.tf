module "cloudflare_r2" {
  source = "./modules/cloudflare_r2"

  environment               = var.environment
  account_id                = var.cloudflare_account_id
  zone_id                   = var.cloudflare_zone_id
  bucket_name               = var.cloudflare_r2_bucket_name
  custom_domain             = var.cloudflare_r2_domain
  r2_access_key             = var.cloudflare_r2_access_key
  r2_secret_key             = var.cloudflare_r2_secret_key
}

module "supabase_postgres" {
  source = "./modules/supabase_postgres"

  project_name      = var.supabase_project_name
  organization_slug = var.supabase_organization_slug
  region            = var.supabase_region
  plan              = var.supabase_plan
  db_password       = var.supabase_db_password
}

module "vercel_app" {
  source = "./modules/vercel_app"

  environment        = var.environment
  project_name       = var.vercel_project_name
  team_id            = var.vercel_team_id
  db_connection_uri  = module.supabase_postgres.connection_uri
  cloudflare_r2_host = module.cloudflare_r2.bucket_public_domain
  openai_api_key     = var.openai_api_key
  elevenlabs_api_key = var.elevenlabs_api_key
  r2_access_key      = module.cloudflare_r2.app_access_key
  r2_secret_key      = module.cloudflare_r2.app_secret_key
  supabase_service_role_key = var.supabase_service_role_key
}

resource "null_resource" "prisma_migrate" {
  count = var.run_local_migrations ? 1 : 0

  depends_on = [
    module.supabase_postgres,
    module.vercel_app
  ]

  provisioner "local-exec" {
    working_dir = "${path.module}/../.."
    environment = {
      DATABASE_URL = module.supabase_postgres.connection_uri
    }
    command = "npm run db:push && npm run db:seed"
  }
}
