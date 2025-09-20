# Terraform infrastructure

This directory provisions every external dependency for the language learning app.
It assumes that _all_ infrastructure is declared as code so that no manual setup is
required in provider dashboards.

## Layout

```
infra/terraform/
├── backend.tf           # add your backend configuration (Terraform Cloud / S3 etc.)
├── versions.tf          # required providers and Terraform version pin
├── providers.tf         # providers configured from variables
├── variables.tf         # shared input variables
├── main.tf              # wires Cloudflare R2, Supabase Postgres, Vercel modules together
├── outputs.tf           # shared outputs (R2 bucket, DB URL, Vercel project id)
├── env/
│   ├── dev.tfvars       # sample variables for dev environment
│   └── prod.tfvars      # sample variables for prod environment
└── modules/
    ├── cloudflare_r2/   # R2 bucket, custom domain, cache rules
    ├── supabase_postgres/ # Supabase project provisioning and connection string output
    └── vercel_app/      # Vercel project and environment variables
```

## Usage

1. Configure the backend in `backend.tf` (Terraform Cloud, S3, etc.). Commit the file
   with placeholders but keep actual credentials out of version control.
2. Supply sensitive variables via your backend workspaces (recommended) or a local
   `terraform.tfvars` that is not committed.
3. Run Terraform:

```bash
cd infra/terraform
terraform init
terraform plan -var-file=env/dev.tfvars
terraform apply -var-file=env/dev.tfvars
```

## Required Secrets

You will need to provide the following values (usually through Terraform Cloud
workspace variables or `TF_VAR_...` environment variables):

- `cloudflare_api_token`: token with R2, DNS and Ruleset permissions
- `cloudflare_account_id`, `cloudflare_zone_id`: taken from your Cloudflare account
- `cloudflare_r2_access_key`, `cloudflare_r2_secret_key`: application credentials
  (if you prefer Terraform to generate them, replace the variables with the
  appropriate resource and update the outputs)
- `supabase_access_token`: Supabase personal access token
- `supabase_organization_slug`: Supabase 組織スラッグ
- `supabase_db_password`: Supabase プロジェクトの DB パスワード
- `vercel_api_token` and optionally `vercel_team_id`
- `openai_api_key`, `elevenlabs_api_key`, `supabase_service_role_key` (if Supabase is used)

The outputs expose the Supabase connection URI so it can be injected into the frontend
via Vercel environment variables.
