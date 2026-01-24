variable "project_ref" {
  description = "Supabase project reference ID"
  type        = string
}

variable "is_production" {
  description = "Whether this is the production environment (enables SMTP, higher rate limits)"
  type        = bool
  default     = false
}
