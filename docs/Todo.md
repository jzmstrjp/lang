# R2移行プロジェクト - Supabase PostgreSQL → Cloudflare R2

## 📊 現状分析

- **問題**: 音声・画像をBase64でPostgreSQLに保存している（`ProblemAsset`テーブル）
- **影響**: DBサイズ肥大化、パフォーマンス劣化、コスト増加
- **解決策**: Cloudflare R2への移行でファイルストレージを分離

## ✅ 完了済み

- **Terraformコード簡素化**: CDN（R2）のみの管理に変更
- **既存インフラ活用**: Supabase、Vercel、GitHub Actionsはそのまま利用
- **設定ファイル準備**: `.env.tfvars`とセキュリティ設定完了

## 🎯 目標アーキテクチャ

### Before (現在)

```
OpenAI TTS/DALL-E → Base64 → PostgreSQL (ProblemAsset)
                              ↓
                         Next.js API → フロントエンド
```

### After (目標)

```
OpenAI TTS/DALL-E → R2 Upload → Cloudflare R2
                              ↓ (URL)
                         PostgreSQL (Problem) → Next.js API → フロントエンド
                                                      ↓
                                               CDN経由でメディア配信
```

## 🗃️ スキーマ変更

### 削除対象

- `ProblemAsset` テーブル全体を削除
- `Problem.asset` リレーション削除

### 変更対象

- `Problem` テーブルにR2 URL用フィールドを追加（既に存在を確認済み）:
  - ✅ `audioEnUrl: String?`
  - ✅ `audioJaUrl: String?`
  - ✅ `compositeImageUrl: String?`

## 🔄 段階的移行計画

### Phase 0: インフラ準備 🔄

- [x] Terraformコード簡素化（R2のみ）
- [x] 設定ファイル準備（`.env.tfvars`）
- [x] セキュリティ設定（`.gitignore`更新）
- [x] Terraformプロバイダー問題修正（versions.tf追加）
- [x] Terraform初期化完了
- [x] **完了**: Cloudflare認証情報取得・設定
  - [x] Cloudflare Account ID取得：`d6440650d9139a91a55c362227fb9310`
  - [x] API Token作成（R2権限）
  - [x] R2 Access Key/Secret Key取得
  - [x] `prod.tfvars`に実際の値を設定
- [x] **完了**: Cloudflare R2バケット作成（Terraform実行）
  - [x] **prod環境**: `prod-lang-media` バケット作成済み（apacロケーション）
  - [x] **バケットURL**: `https://prod-lang-media.d6440650d9139a91a55c362227fb9310.r2.cloudflarestorage.com`
  - [x] **ロケーション**: APAC（アジア太平洋）- 日本のユーザーに最適化
- [ ] **次のステップ**: dev環境も同様に作成（オプション）

### Phase 1: R2アップロード機能実装 ✅

- [x] R2クライアント用ライブラリ作成 (`src/lib/r2-client.ts`)
- [x] 音声ファイル用アップロード関数
- [x] 画像ファイル用アップロード関数
- [x] 環境変数設定の確認・更新

### Phase 2: API修正 ✅

- [x] `generateSpeech()` - Base64返却をR2アップロード+URL返却に変更
- [x] `generateImage()` - Base64返却をR2アップロード+URL返却に変更
- [x] `saveGeneratedProblem()` - ProblemAsset保存をProblem URL更新に変更
- [x] `fetchCachedProblem()` - asset参照をURL直接参照に変更

### Phase 3: 既存データ移行 ⏭️

- [x] **スキップ**: 既存データ破棄で新システムに移行

### Phase 4: スキーマクリーンアップ ✅

- [x] Prismaスキーマから`ProblemAsset`モデル削除
- [x] `Problem.asset`リレーション削除
- [x] データベースリセット・新スキーマ適用
- [x] TypeScript型定義更新

### Phase 5: フロントエンド対応 ✅

- [x] `problem-flow.tsx` - URL直接参照で動作確認
- [x] APIレスポンス型の互換性確認

### Phase 6: 完了 ✅

- [x] `problem_assets`テーブル削除完了
- [x] 不要なコード削除完了
- [x] 全体テスト・TypeScriptエラー確認完了

## 🔧 必要な環境変数

### Terraform用（`.env.tfvars`）✅

```bash
# Cloudflare設定
cloudflare_account_id     = "your-cloudflare-account-id"
cloudflare_api_token      = "your-cloudflare-api-token"
cloudflare_zone_id        = "your-cloudflare-zone-id"
cloudflare_r2_access_key  = "your-r2-access-key"
cloudflare_r2_secret_key  = "your-r2-secret-key"
```

### Vercel環境変数（Terraform完了後に手動設定）

```bash
# R2アクセス認証
R2_ACCESS_KEY_ID="your_access_key"
R2_SECRET_ACCESS_KEY="your_secret_key"

# R2バケット設定
R2_BUCKET_NAME="lang-media"
R2_PUBLIC_URL="https://media.example.com"  # CDN経由のパブリックURL
```

### 追加で必要になる可能性

```bash
# R2リージョン（必要に応じて）
R2_REGION="auto"

# アップロード用の署名付きURL有効期限（オプション）
R2_UPLOAD_EXPIRY_MINUTES=60
```

## 📝 実装チェックリスト

### ライブラリ・ユーティリティ

- [ ] `src/lib/r2-client.ts` - S3互換APIクライアント
- [ ] `src/lib/audio-utils.ts` - R2アップロード対応
- [ ] `src/lib/image-utils.ts` - 画像アップロード用（新規作成）

### API修正

- [ ] `src/app/api/problem/generate/route.ts`
- [ ] `src/lib/problem-storage.ts`

### スキーマ・DB

- [ ] `prisma/schema.prisma` - ProblemAsset削除
- [ ] 新しいマイグレーション作成
- [ ] 移行スクリプト (`scripts/migrate-to-r2.ts`)

### フロントエンド

- [ ] `src/components/problem/problem-flow.tsx`
- [ ] 型定義更新

### テスト・検証

- [ ] 移行前後でのレスポンス確認
- [ ] パフォーマンステスト
- [ ] CDN配信確認

## ⚠️ 注意事項

1. **ダウンタイムなし移行**: 新しいデータはR2、既存データは段階的移行
2. **ロールバック準備**: 移行失敗時のProblemAsset復元手順
3. **CDNキャッシュ**: R2→CDN反映の遅延を考慮
4. **コスト監視**: R2使用量とegress費用の監視

## 📈 期待効果

- **DB容量削減**: 90%以上の削減見込み
- **レスポンス向上**: メディアファイル分離でAPI高速化
- **CDN活用**: グローバル配信とキャッシュ効果
- **スケーラビリティ**: 大量メディアファイル対応
- **コスト最適化**: egress無料のR2活用
