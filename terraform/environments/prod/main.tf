# Production Environment
#
# Supabase project: ckjcrkjpmhqhiucifukx
# URL: https://ckjcrkjpmhqhiucifukx.supabase.co

module "supabase" {
  source = "../../modules/supabase"

  project_ref   = "ckjcrkjpmhqhiucifukx"
  is_production = true
}
