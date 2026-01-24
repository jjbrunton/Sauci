variable "supabase_access_token" {
  description = "Supabase API access token"
  type        = string
  sensitive   = true
}

# Project refs per environment (selected by workspace)
locals {
  project_refs = {
    production     = "ckjcrkjpmhqhiucifukx"
    non-production = "itbzhrvlgvdmzbnhzhyx"
    default        = "itbzhrvlgvdmzbnhzhyx" # Default workspace uses non-prod
  }

  # Select project_ref based on current workspace
  project_ref = lookup(local.project_refs, terraform.workspace, local.project_refs["default"])

  # Environment detection
  is_production = terraform.workspace == "production"

  # SMTP settings (only production has custom SMTP configured)
  smtp_settings = local.is_production ? {
    smtp_admin_email   = "team@send.sauci.app"
    smtp_host          = "smtp.resend.com"
    smtp_max_frequency = 1
    smtp_port          = "465"
    smtp_sender_name   = "Sauci App"
    smtp_user          = "resend"
  } : {}

  # Rate limit for email (requires custom SMTP in production)
  rate_limit_email_sent = local.is_production ? 25 : 3
}

variable "project_ref" {
  description = "Supabase project reference ID (overrides workspace-based selection)"
  type        = string
  default     = ""
}

# Auth provider secrets (stored in Supabase dashboard, referenced here for documentation)
variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "apple_client_id" {
  description = "Apple OAuth client ID (Services ID)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "apple_client_secret" {
  description = "Apple OAuth client secret (JWT)"
  type        = string
  sensitive   = true
  default     = ""
}
