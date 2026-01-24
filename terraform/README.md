# Terraform Infrastructure

This directory contains Terraform configuration for managing Supabase project settings as Infrastructure as Code (IaC).

## Directory Structure

```
terraform/
├── modules/
│   └── supabase/           # Shared Supabase configuration module
│       ├── main.tf         # Resource definitions
│       ├── variables.tf    # Module inputs
│       ├── outputs.tf      # Module outputs
│       └── templates/      # Email templates
├── environments/
│   ├── prod/               # Production (ckjcrkjpmhqhiucifukx)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── versions.tf
│   │   └── outputs.tf
│   └── non-prod/           # Non-production (itbzhrvlgvdmzbnhzhyx)
│       ├── main.tf
│       ├── variables.tf
│       ├── versions.tf
│       └── outputs.tf
└── README.md
```

## What's Managed

| Resource | Description |
|----------|-------------|
| `supabase_settings` | API config, Auth settings, Connection pooler |

**Not managed by Terraform** (managed via migrations/CLI):
- Database schema & migrations
- Edge functions
- Storage buckets
- RLS policies

## Initial Setup

### 1. Install Terraform

```bash
# macOS
brew install terraform

# Or download from https://terraform.io/downloads
```

### 2. Get Supabase Access Token

1. Go to https://supabase.com/dashboard/account/tokens
2. Create a new token
3. Save it securely

### 3. Initialize an Environment

```bash
cd terraform/environments/non-prod  # or prod
export TF_VAR_supabase_access_token=sbp_xxxxx
terraform init
```

### 4. Import Existing Settings

For each environment, import the existing Supabase settings:

```bash
# Non-prod
cd terraform/environments/non-prod
terraform import module.supabase.supabase_settings.main itbzhrvlgvdmzbnhzhyx

# Prod
cd terraform/environments/prod
terraform import module.supabase.supabase_settings.main ckjcrkjpmhqhiucifukx
```

### 5. Verify Configuration

```bash
terraform plan
```

If the plan shows changes, update the module to match the current settings, then re-run plan until it shows no changes.

## Workflow: Making Changes

**Always test in non-prod first, then promote to prod.**

### 1. Make Changes to the Module

Edit files in `terraform/modules/supabase/` to change shared configuration.

### 2. Apply to Non-Prod

```bash
cd terraform/environments/non-prod
export TF_VAR_supabase_access_token=sbp_xxxxx
terraform plan   # Review changes
terraform apply  # Apply changes
```

### 3. Verify in Non-Prod

Test the changes in the non-prod environment.

### 4. Apply to Prod

```bash
cd terraform/environments/prod
export TF_VAR_supabase_access_token=sbp_xxxxx
terraform plan   # Review changes
terraform apply  # Apply changes
```

### 5. Commit Changes

```bash
git add terraform/
git commit -m "Update Supabase settings: <description>"
git push
```

## Environment-Specific Settings

Some settings differ between environments. These are controlled by the `is_production` variable in the module:

| Setting | Production | Non-Prod |
|---------|-----------|----------|
| SMTP | Resend (custom) | Default |
| Email rate limit | 25/hour | 3/hour |

## CI/CD

The GitHub Action (`.github/workflows/deploy-supabase.yml`) can be configured to:
- Run `terraform plan` on PRs
- Run `terraform apply` on merge to master

Required secret: `SUPABASE_ACCESS_TOKEN`

Update the workflow to use the new directory structure:

```yaml
- name: Apply to Non-Prod
  working-directory: terraform/environments/non-prod
  run: terraform apply -auto-approve

- name: Apply to Prod
  working-directory: terraform/environments/prod
  run: terraform apply -auto-approve
```

## Remote State (Recommended)

For team environments, configure a remote backend in each environment's `versions.tf`:

- **Terraform Cloud** (free for small teams)
- **S3 backend** (if you have AWS)

## Secrets

**Never commit secrets to git!**

- Use environment variables: `export TF_VAR_supabase_access_token=...`
- Use GitHub Secrets for CI/CD
- OAuth provider credentials are set in Supabase Dashboard, not Terraform

## Migration from Workspace-Based Setup

If you previously used Terraform workspaces, migrate as follows:

1. Export state from old setup:
   ```bash
   cd terraform  # old location
   terraform workspace select production
   terraform state pull > prod.tfstate
   terraform workspace select non-production
   terraform state pull > non-prod.tfstate
   ```

2. Import state to new environments:
   ```bash
   cd environments/prod
   terraform init
   terraform state push ../../prod.tfstate

   cd ../non-prod
   terraform init
   terraform state push ../../non-prod.tfstate
   ```

3. Verify with `terraform plan` in each environment
4. Delete old workspace-based files from terraform root
