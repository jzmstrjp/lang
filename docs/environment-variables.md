# 環境変数設定

## 必要な環境変数

R2機能を使用するために、以下の環境変数を設定してください：

### データベース

```bash
DATABASE_URL="your-supabase-database-url"
```

### OpenAI

```bash
OPENAI_API_KEY="your-openai-api-key"
```

### Cloudflare R2（新規追加）

```bash
R2_BUCKET_NAME="prod-lang-media"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
```

## Vercel環境変数設定

Vercelダッシュボードで以下の環境変数を設定してください：

1. **R2_BUCKET_NAME**: `prod-lang-media`
2. **R2_ACCESS_KEY_ID**: Cloudflareダッシュボードから取得した Access Key ID
3. **R2_SECRET_ACCESS_KEY**: Cloudflareダッシュボードから取得した Secret Access Key

## GitHub Actions Secrets設定

GitHub ActionsでR2アップロード機能を使用するため、リポジトリのSecretsに以下を追加してください：

1. **R2_BUCKET_NAME**: `prod-lang-media`
2. **R2_ACCESS_KEY_ID**: Cloudflareダッシュボードから取得した Access Key ID
3. **R2_SECRET_ACCESS_KEY**: Cloudflareダッシュボードから取得した Secret Access Key

設定方法：

1. GitHubリポジトリの Settings → Secrets and variables → Actions
2. 「New repository secret」をクリック
3. 上記の環境変数を一つずつ追加

## R2認証情報の取得方法

1. Cloudflareダッシュボードにログイン
2. 「R2 Object Storage」セクションに移動
3. 「Manage R2 API tokens」をクリック
4. 新しいAPI Tokenを作成（Read & Write権限）
5. 作成されたAccess Key IDとSecret Access Keyをコピー

## ローカル開発用

ローカル開発では、プロジェクトルートに`.env.local`ファイルを作成：

```bash
# .env.local
DATABASE_URL="your-supabase-database-url"
OPENAI_API_KEY="your-openai-api-key"
R2_BUCKET_NAME="prod-lang-media"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
```

**注意**: `.env.local`ファイルは機密情報を含むため、Gitにコミットしないでください。
