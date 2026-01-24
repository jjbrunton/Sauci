output "environment" {
  description = "Environment name"
  value       = "production"
}

output "project_ref" {
  description = "Supabase project reference"
  value       = module.supabase.project_ref
}

output "project_url" {
  description = "Supabase project URL"
  value       = module.supabase.project_url
}
