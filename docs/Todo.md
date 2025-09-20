# TODO: 永続化・キャッシュ・クラウド対応メモ

## データ永続化

- [ ] Prisma スキーマに `word_count` と `interaction_intent` を追加し、migrate + seed を整備
- [ ] 生成した Problem を RDS/Supabase に書き込むサービス層を実装（単発生成もキャッシュ前提に）
- [ ] 問題の重複検出（english + interactionIntent + scene_id）を Prisma レベルで実装し、ユニーク制約 or 事前チェックを導入
- [ ] 生成ログを保存するテーブル（prompt, model, cost, status）を作成し、異常検知や再生成に備える

## キャッシュ戦略

- [ ] `GET /api/problem` でキャッシュ優先（`is_cached=true`）→不足時のみ生成するロジックに切り替え
- [ ] R2 上の音声／画像 URL を Problem レコードと紐づけ、期限切れチェックと再生成フローを設計
- [ ] 端末側の一時キャッシュ戦略（prefetch・問題履歴保持）を検討し、UX の遅延を抑える
- [ ] キャッシュ容量監視と自動クリーンアップ（古い `is_cached=false` のメディア削除）をジョブ化

## クラウド構成

- [ ] Terraform で Cloudflare R2 / Supabase / Vercel を IaC 化し、開発・本番環境を分離
- [ ] GitHub Actions にデプロイ前の lint / typecheck / テストを組み込み、Terraform Plan を自動実行
- [ ] Secrets / API keys を Terraform Cloud or Secrets Manager に統合し、ローカル `.env` との同期手順を文書化
- [ ] メトリクス（生成数、キャッシュヒット率、API コスト）をモニタリングできるよう、Supabase Functions or 外部サービスに送信

## クラウド運用

- [ ] Cloudflare / OpenAI / Supabase の利用料アラートを Terraform か監視サービスで設定
- [ ] 障害時フォールバック（R2 画像／音声が取れない場合の代替）が動くかをステージングで検証
- [ ] データバックアップ（Supabase export, R2 バージョニング）ポリシーを策定
