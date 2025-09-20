# TODO: 本実装フェーズ（Terraform前提）

## 1. Terraformで基盤を固める

- [ ] Terraform Cloud or S3 Backend を用意し、`dev`/`prod` ワークスペースを分離
- [x] Cloudflare プロバイダで R2 バケット＋カスタムドメイン＋キャッシュルールを IaC 化
- [x] Supabase プロジェクト（PostgreSQL）を Terraform で定義し、DB パスワードを Secrets 化
- [x] Vercel プロジェクト／環境変数／デプロイフックを Terraform で管理し、手動操作をゼロにする
- [x] OpenAI・ElevenLabs など外部 API キーを Terraform Secrets 管理で登録（ローカル検証用 `.env` も整備）

## 2. データモデルとマイグレーション

- [x] Prisma を導入し `Problem` モデルを tech.md §9 通り定義
- [ ] `Problem` モデルに `word_count` と `interaction_intent` を追加し、API から保存できるようにする
- [ ] `prisma migrate deploy` を Terraform の `null_resource` 等で自動実行できる仕組みを用意
- [ ] Seed スクリプトで最小サンプルデータを投入し、CI で `prisma migrate reset --skip-seed` を回して健全性確認

## 3. 生成＆キャッシュパイプライン

- [ ] `POST /api/admin/generate` を実装（サーバーオンリー）。Supabase に Problem を保存 → R2 へ音声・画像をアップロード
- [ ] キャッシュ戦略（カテゴリごと 30 問閾値、90%キャッシュ/10%新規、`is_cached`/`quality_check` 制御）をサービス層で実装
- [ ] Cloudflare R2 の TTL / バージョニング / キャッシュ削除 API を Terraform とアプリコード両面で整備
- [ ] `interactionIntent` の比率をモニタリングし、agreement/opinion が十分混ざるよう生成ロジックを調整

## 4. 出題 API

- [ ] `GET /api/problem?type=short|medium|long` を実装し、キャッシュプール不足時のみ同期生成するロジックを実装
- [ ] API レスポンスに音声・画像の CDN URL を含め、クライアントが即再生できる形にする
- [ ] 失敗時フォールバック（既存キャッシュから出題、音声欠損時はテキスト提示）を codify し、ユニットテストを追加

## 5. フロントエンド更新

- [x] `/problems/[length]` ページを API フェッチベースに書き換え。ローディング／エラー UI と自動再取得ロジックを実装
- [ ] 自動再生が拒否された場合の再試行 UI（tech.md §15）を導入
- [ ] 結果画面に正解音声再生ボタン・簡易解説を表示し、次の問題取得を API と連携

## 6. オブザーバビリティと運用

- [ ] 匿名計測イベント（開始、英文再生、4択表示、回答、正誤、次へ）を埋め込み SaaS か Supabase テーブルに送信
- [ ] Cloudflare / OpenAI / Supabase のコスト監視アラートを Terraform で設定
- [ ] GitHub Actions に lint (`npm run lint`)・type check (`npx tsc --noEmit`)・format check (`npm run format:check`) を組み込み

## 7. データ品質と初期ストック

- [ ] type ごと 30 問 × 3 カテゴリ（計 90 問）を生成し、品質レビュー（`quality_check=true`）のルールをドキュメント化
- [ ] サンプル問題をレビューし、`short` の超短文と `long` の複合文が仕様どおりに生成されるか確認
- [ ] 日本語リプライがヒントとして機能しつつ選択肢と重複しないか、テンプレ違反の自動チェックを実装
- [ ] 音量 -16 LUFS・冒頭無音 ≤200ms の自動検証スクリプトを用意
- [ ] 生成パイプラインで `pattern_group`/`scene_id` の重複チェックを組み込み

## 8. 将来拡張に備える

- [ ] Dialogue モデル導入のための Prisma スキーマ下書きと Terraform リソースを用意
- [ ] ジャンルフィルタ UI をモックし、API に `genre` クエリ対応を追加
- [ ] Terraform でステージング環境（dev/prd）を完全再現できるようモジュール化
