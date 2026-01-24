terraform {
  required_version = ">= 1.0"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
  }

  # Store state remotely (recommended for team environments)
  # Uncomment and configure one of these backends:

  # Option 1: Terraform Cloud
  # cloud {
  #   organization = "your-org"
  #   workspaces {
  #     name = "sauci-non-prod"
  #   }
  # }

  # Option 2: S3 backend
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "sauci/non-prod/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "supabase" {
  access_token = var.supabase_access_token
}
