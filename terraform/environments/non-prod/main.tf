# Non-Production Environment (Staging/Development)
#
# Supabase project: itbzhrvlgvdmzbnhzhyx
# URL: https://itbzhrvlgvdmzbnhzhyx.supabase.co
#
# Use this environment to test Terraform changes before applying to production.

module "supabase" {
  source = "../../modules/supabase"

  project_ref   = "itbzhrvlgvdmzbnhzhyx"
  is_production = false
}
