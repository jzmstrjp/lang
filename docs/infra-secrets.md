# Secrets & API keys checklist

Terraform だけでプロビジョニングするため、`terraform apply` 前に以下のシークレットを
準備してください。

| Provider            | Variable / usage                                        | 備考                                                     |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| **Cloudflare**      | `cloudflare_api_token`                                  | R2 (Objects Read/Write)、DNS (Edit)、Rulesets 権限が必要 |
|                     | `cloudflare_account_id`, `cloudflare_zone_id`           | Cloudflare ダッシュボードで確認                          |
|                     | `cloudflare_r2_access_key` / `cloudflare_r2_secret_key` | R2 の S3 互換 API トークンを発行して安全に保管           |
| **Supabase**        | `supabase_access_token`                                 | Terraform プロバイダ用の Personal Access Token           |
|                     | `supabase_organization_slug`                            | Supabase の組織スラッグ (例: `my-org`)                   |
|                     | `supabase_db_password`                                  | プロジェクト作成時に設定する DB パスワード               |
| **Vercel**          | `vercel_api_token`                                      | プロジェクト管理権限のある API トークン                  |
|                     | `vercel_team_id` (任意)                                 | チームに属している場合のみ指定                           |
| **OpenAI**          | `openai_api_key`                                        | テキスト生成／TTS 用                                     |
| **ElevenLabs**      | `elevenlabs_api_key`                                    | TTS 用 (採用する場合)                                    |
| **Supabase (任意)** | `supabase_service_role_key`                             | Supabase の追加データ機能を使う場合のみ                  |

これらは Terraform Cloud の Workspace Variables などに登録するか、ローカル実行時は
`TF_VAR_...` 環境変数として設定してください。

ローカルで Prisma コマンドを動かすときは、Terraform の出力から `DATABASE_URL` を
エクスポートします。

```bash
export DATABASE_URL="$(terraform -chdir=infra/terraform output -raw supabase_connection_uri)"
npm run db:push
npm run db:seed
```
