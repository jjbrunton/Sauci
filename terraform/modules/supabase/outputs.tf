output "project_ref" {
  description = "Supabase project reference"
  value       = var.project_ref
}

output "project_url" {
  description = "Supabase project URL"
  value       = "https://${var.project_ref}.supabase.co"
}
