# 英語学習アプリ

## セットアップ

### 環境変数の設定

`.env`ファイルをプロジェクトルートに作成し、以下の環境変数を設定してください：

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# OpenAI API (問題生成に使用)
OPENAI_API_KEY="your_openai_api_key_here"
```

## 問題データの生成

### GPT APIを使った問題生成

OpenAI GPT APIを使って自動的に問題を生成できます：

```bash
# デフォルト: 30問（5問×6回）を生成
npm run generate:problems

# 生成回数を指定: 50問（5問×10回）
npm run generate:problems 10

# 生成回数を指定: 100問（5問×20回）
npm run generate:problems 20
```

このコマンドは：

1. `docs/prompt-for-qustion.md`のプロンプトを読み込み
2. GPT APIを呼び出して指定回数分の問題を生成（各回5問）
3. 会話履歴を保持しながら「さらに5問お願いします」を繰り返す
4. `problemData/problemN.ts`ファイルとして保存します

生成後、以下のコマンドでデータベースに登録できます：

```bash
npm run db:seed problemData/problemN.ts
```

### 手動での問題作成

`problemData/`ディレクトリにTypeScriptファイルを作成し、問題データを定義することもできます。

## データベース操作

```bash
# すべての問題をシード
npm run db:seed
```
