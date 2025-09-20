# NOTE: The supabase Terraform provider is evolving. Adjust resource attributes based on the
# provider version you install. This example assumes the provider exposes a supabase_project
# resource that returns connection details.

resource "supabase_project" "this" {
  organization_slug = var.organization_slug
  name              = var.project_name
  region            = var.region
  plan              = var.plan
  database_password = var.db_password
}

# Output connection string using the project defaults. Update the expression if the provider
# exposes the fields differently.
locals {
  connection_string = supabase_project.this.database.connection_string
}
