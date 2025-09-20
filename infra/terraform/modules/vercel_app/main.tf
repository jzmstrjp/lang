locals {
  vercel_targets = ["production", "preview", "development"]
}

resource "vercel_project" "app" {
  name      = var.project_name
  framework = var.framework

  team_id = var.team_id != "" ? var.team_id : null
}

resource "vercel_project_environment_variable" "database_url" {
  project_id = vercel_project.app.id
  key        = "DATABASE_URL"
  value      = var.db_connection_uri
  target     = local.vercel_targets
}

resource "vercel_project_environment_variable" "r2_bucket_url" {
  project_id = vercel_project.app.id
  key        = "R2_PUBLIC_URL"
  value      = "https://${var.cloudflare_r2_host}"
  target     = local.vercel_targets
}

resource "vercel_project_environment_variable" "r2_access_key" {
  project_id = vercel_project.app.id
  key        = "R2_ACCESS_KEY_ID"
  value      = var.r2_access_key
  target     = local.vercel_targets
}

resource "vercel_project_environment_variable" "r2_secret_key" {
  project_id = vercel_project.app.id
  key        = "R2_SECRET_ACCESS_KEY"
  value      = var.r2_secret_key
  target     = local.vercel_targets
}

resource "vercel_project_environment_variable" "openai_api_key" {
  project_id = vercel_project.app.id
  key        = "OPENAI_API_KEY"
  value      = var.openai_api_key
  target     = local.vercel_targets
}

resource "vercel_project_environment_variable" "elevenlabs_api_key" {
  project_id = vercel_project.app.id
  key        = "ELEVENLABS_API_KEY"
  value      = var.elevenlabs_api_key
  target     = local.vercel_targets
}

resource "vercel_project_environment_variable" "supabase_service_role_key" {
  count      = var.supabase_service_role_key == "" ? 0 : 1
  project_id = vercel_project.app.id
  key        = "SUPABASE_SERVICE_ROLE_KEY"
  value      = var.supabase_service_role_key
  target     = local.vercel_targets
}
