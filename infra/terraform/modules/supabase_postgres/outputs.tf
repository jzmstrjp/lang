output "project_id" {
  value = supabase_project.this.id
}

output "connection_uri" {
  value       = local.connection_string
  description = "PostgreSQL connection string for Supabase project."
  sensitive   = true
}
