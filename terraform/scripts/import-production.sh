#!/bin/bash
set -e

# Import existing Supabase production settings into Terraform state
# This script helps extract current configuration for IaC management
#
# Prerequisites:
# 1. Set SUPABASE_ACCESS_TOKEN environment variable
# 2. Run from the terraform directory

PROJECT_REF="ckjcrkjpmhqhiucifukx"

echo "=== Supabase Terraform Import Script ==="
echo ""

# Check for access token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Error: SUPABASE_ACCESS_TOKEN environment variable is not set"
    echo ""
    echo "Get your token from: https://supabase.com/dashboard/account/tokens"
    echo "Then run: export SUPABASE_ACCESS_TOKEN=sbp_xxxxx"
    exit 1
fi

# Export for Terraform
export TF_VAR_supabase_access_token="$SUPABASE_ACCESS_TOKEN"

echo "1. Initializing Terraform..."
terraform init

echo ""
echo "2. Importing production settings..."
echo "   Project: $PROJECT_REF"
echo ""

# Import settings (will fail if already imported, that's OK)
terraform import supabase_settings.production "$PROJECT_REF" 2>/dev/null || echo "   (Settings may already be imported)"

echo ""
echo "3. Showing current state..."
echo ""
terraform show

echo ""
echo "=== Import Complete ==="
echo ""
echo "Next steps:"
echo "1. Review the terraform show output above"
echo "2. Update main.tf to match your actual production settings"
echo "3. Run 'terraform plan' to verify no changes are needed"
echo "4. Commit the updated main.tf"
