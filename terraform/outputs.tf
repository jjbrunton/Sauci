output "workspace" {
  description = "Current Terraform workspace"
  value       = terraform.workspace
}

output "project_ref" {
  description = "Supabase project reference"
  value       = local.project_ref
}

output "project_url" {
  description = "Supabase project URL"
  value       = "https://${local.project_ref}.supabase.co"
}
