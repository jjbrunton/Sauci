# Supabase Project Configuration Module
#
# This module manages Supabase project settings including API, Auth, Network, and Storage.
# Environment-specific settings (SMTP, rate limits) are controlled via input variables.

# Base auth settings (shared across all environments)
locals {
  auth_base = {
    # Site URL and redirects
    site_url       = "https://sauci.app"
    uri_allow_list = "app.sauci://**,app.sauci://(auth)/login"

    # Signup and auth settings
    disable_signup                   = false
    external_anonymous_users_enabled = true
    external_email_enabled           = true
    external_phone_enabled           = false

    # OAuth providers
    external_google_enabled          = true
    external_google_client_id        = "764866133492-57iilbc72t1urtmurgioci9tne5l6j67.apps.googleusercontent.com,764866133492-4g566mrb8tm5uti4ejub6oogcvnln7kc.apps.googleusercontent.com,764866133492-e78o2rh3rdjc4rfj2j6r2j77b065kggm.apps.googleusercontent.com"
    external_google_email_optional   = false
    external_google_skip_nonce_check = false

    external_apple_enabled        = true
    external_apple_client_id      = "com.sauci.app"
    external_apple_email_optional = false

    # Disabled OAuth providers (with email_optional settings)
    external_azure_enabled                = false
    external_azure_email_optional         = false
    external_bitbucket_enabled            = false
    external_bitbucket_email_optional     = false
    external_discord_enabled              = false
    external_discord_email_optional       = false
    external_facebook_enabled             = false
    external_facebook_email_optional      = false
    external_figma_enabled                = false
    external_figma_email_optional         = false
    external_github_enabled               = false
    external_github_email_optional        = false
    external_gitlab_enabled               = false
    external_gitlab_email_optional        = false
    external_kakao_enabled                = false
    external_kakao_email_optional         = false
    external_keycloak_enabled             = false
    external_keycloak_email_optional      = false
    external_linkedin_oidc_enabled        = false
    external_linkedin_oidc_email_optional = false
    external_notion_enabled               = false
    external_notion_email_optional        = false
    external_slack_enabled                = false
    external_slack_email_optional         = false
    external_slack_oidc_enabled           = false
    external_slack_oidc_email_optional    = false
    external_spotify_enabled              = false
    external_spotify_email_optional       = false
    external_twitch_enabled               = false
    external_twitch_email_optional        = false
    external_twitter_enabled              = false
    external_twitter_email_optional       = false
    external_workos_enabled               = false
    external_zoom_enabled                 = false
    external_zoom_email_optional          = false
    external_web3_ethereum_enabled        = false
    external_web3_solana_enabled          = false

    # JWT settings
    jwt_exp                               = 3600
    refresh_token_rotation_enabled        = true
    security_refresh_token_reuse_interval = 10

    # Session settings
    sessions_inactivity_timeout = 0
    sessions_single_per_user    = false
    sessions_timebox            = 0

    # API settings
    api_max_request_duration = 10
    db_max_pool_size         = 10
    db_max_pool_size_unit    = "connections"

    # Password settings
    password_min_length   = 6
    password_hibp_enabled = false

    # Rate limits (NOT including rate_limit_email_sent - requires custom SMTP)
    rate_limit_anonymous_users = 30
    rate_limit_otp             = 30
    rate_limit_sms_sent        = 30
    rate_limit_token_refresh   = 150
    rate_limit_verify          = 30
    rate_limit_web3            = 30

    # MFA settings
    mfa_max_enrolled_factors     = 10
    mfa_totp_enroll_enabled      = true
    mfa_totp_verify_enabled      = true
    mfa_phone_enroll_enabled     = false
    mfa_phone_verify_enabled     = false
    mfa_phone_max_frequency      = 5
    mfa_phone_otp_length         = 6
    mfa_phone_template           = "Your code is {{ .Code }}"
    mfa_web_authn_enroll_enabled = false
    mfa_web_authn_verify_enabled = false

    # SAML
    saml_enabled = false

    # Security settings
    security_captcha_enabled                          = false
    security_captcha_provider                         = "hcaptcha"
    security_manual_linking_enabled                   = true
    security_update_password_require_reauthentication = false

    # Email/mailer settings
    mailer_autoconfirm                     = false
    mailer_allow_unverified_email_sign_ins = false
    mailer_secure_email_change_enabled     = true
    mailer_otp_exp                         = 3600
    mailer_otp_length                      = 8

    # Mailer notifications
    mailer_notifications_email_changed_enabled         = false
    mailer_notifications_identity_linked_enabled       = false
    mailer_notifications_identity_unlinked_enabled     = false
    mailer_notifications_mfa_factor_enrolled_enabled   = false
    mailer_notifications_mfa_factor_unenrolled_enabled = false
    mailer_notifications_password_changed_enabled      = false
    mailer_notifications_phone_changed_enabled         = false

    # Email subjects
    mailer_subjects_confirmation                       = "Confirm Your Signup"
    mailer_subjects_email_change                       = "sauci@jbrunton.co.uk"
    mailer_subjects_email_changed_notification         = "Your email address has been changed"
    mailer_subjects_identity_linked_notification       = "A new identity has been linked"
    mailer_subjects_identity_unlinked_notification     = "An identity has been unlinked"
    mailer_subjects_invite                             = "You have been invited"
    mailer_subjects_magic_link                         = "Your Magic Link"
    mailer_subjects_mfa_factor_enrolled_notification   = "A new MFA factor has been enrolled"
    mailer_subjects_mfa_factor_unenrolled_notification = "An MFA factor has been unenrolled"
    mailer_subjects_password_changed_notification      = "Your password has been changed"
    mailer_subjects_phone_changed_notification         = "Your phone number has been changed"
    mailer_subjects_reauthentication                   = "Confirm Reauthentication"
    mailer_subjects_recovery                           = "Reset Your Password"

    # Email templates (loaded from templates directory)
    mailer_templates_confirmation_content     = file("${path.module}/templates/confirmation.html")
    mailer_templates_email_change_content     = file("${path.module}/templates/email_change.html")
    mailer_templates_invite_content           = file("${path.module}/templates/invite.html")
    mailer_templates_magic_link_content       = file("${path.module}/templates/magic_link.html")
    mailer_templates_recovery_content         = file("${path.module}/templates/recovery.html")
    mailer_templates_reauthentication_content = "Enter the code: {{ .Token }}"

    # Notification templates (simple HTML)
    mailer_templates_email_changed_notification_content         = <<-EOT
      <h2>Your email address has been changed</h2>
      <p>The email address for your account has been changed from {{ .OldEmail }} to {{ .Email }}.</p>
      <p>If you did not make this change, please contact support.</p>
    EOT
    mailer_templates_identity_linked_notification_content       = <<-EOT
      <h2>A new identity has been linked</h2>
      <p>A new identity ({{ .Provider }}) has been linked to your account {{ .Email }}.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    EOT
    mailer_templates_identity_unlinked_notification_content     = <<-EOT
      <h2>An identity has been unlinked</h2>
      <p>An identity ({{ .Provider }}) has been unlinked from your account {{ .Email }}.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    EOT
    mailer_templates_mfa_factor_enrolled_notification_content   = <<-EOT
      <h2>A new MFA factor has been enrolled</h2>
      <p>A new factor ({{ .FactorType }}) has been enrolled for your account {{ .Email }}.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    EOT
    mailer_templates_mfa_factor_unenrolled_notification_content = <<-EOT
      <h2>An MFA factor has been unenrolled</h2>
      <p>A factor ({{ .FactorType }}) has been unenrolled for your account {{ .Email }}.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    EOT
    mailer_templates_password_changed_notification_content      = <<-EOT
      <h2>Your password has been changed</h2>
      <p>This is a confirmation that the password for your account {{ .Email }} has just been changed.</p>
      <p>If you did not make this change, please contact support.</p>
    EOT
    mailer_templates_phone_changed_notification_content         = <<-EOT
      <h2>Your phone number has been changed</h2>
      <p>The phone number for your account {{ .Email }} has been changed from {{ .OldPhone }} to {{ .Phone }}.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    EOT

    # SMS settings
    sms_autoconfirm   = false
    sms_max_frequency = 5
    sms_otp_exp       = 60
    sms_otp_length    = 6
    sms_provider      = "twilio"
    sms_template      = "Your code is {{ .Code }}"

    # Hook settings (only include hooks available on current plan)
    hook_after_user_created_enabled  = false
    hook_before_user_created_enabled = false
    hook_custom_access_token_enabled = false
    hook_send_email_enabled          = false
    hook_send_sms_enabled            = false
    # Note: hook_mfa_verification_attempt and hook_password_verification_attempt
    # require Team plan or higher - omitted to avoid 402 errors
  }

  # Production-only SMTP settings (completely omitted for non-prod)
  auth_smtp = var.is_production ? {
    smtp_admin_email      = "team@send.sauci.app"
    smtp_host             = "smtp.resend.com"
    smtp_max_frequency    = 1
    smtp_port             = "465"
    smtp_sender_name      = "Sauci App"
    smtp_user             = "resend"
    rate_limit_email_sent = 25
  } : {}

  # Final merged auth config
  auth_config = merge(local.auth_base, local.auth_smtp)
}

resource "supabase_settings" "main" {
  project_ref = var.project_ref

  # API Settings
  api = jsonencode({
    db_schema            = "public,graphql_public"
    db_extra_search_path = "public, extensions"
    max_rows             = 1000
  })

  # Auth Settings (merged from base + production SMTP if applicable)
  auth = jsonencode(local.auth_config)

  # Database Settings (empty - managed via migrations)
  database = jsonencode({})

  # Network Settings
  network = jsonencode({
    restrictions = ["0.0.0.0/0", "::/0"]
  })

  # Storage Settings
  storage = jsonencode({
    fileSizeLimit    = 52428800 # 50MB
    databasePoolMode = "recycled"
    migrationVersion = "buckets-objects-grants-postgres"
    capabilities = {
      iceberg_catalog = true
      list_v2         = true
    }
    features = {
      imageTransformation = { enabled = true }
      s3Protocol          = { enabled = true }
      icebergCatalog = {
        enabled       = true
        maxCatalogs   = 2
        maxNamespaces = 10
        maxTables     = 10
      }
      vectorBuckets = {
        enabled    = false
        maxBuckets = 10
        maxIndexes = 5
      }
    }
    external = {
      upstreamTarget = "canary"
    }
  })
}
