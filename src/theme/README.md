# カラーシステム

このディレクトリには、アプリケーション全体で使用する色の定義が含まれています。

## 概要

すべての色はCSS変数として定義され、`src/app/globals.css`で設定されています。
これにより、ダークモード対応が容易になり、色の一貫性が保たれます。

## 使い方

### Tailwindクラスで使用する

```tsx
// 背景色
<div className="bg-[var(--background)]">

// テキスト色
<p className="text-[var(--text)]">

// プライマリーカラー（ボタンなど）
<button className="bg-[var(--primary)] text-[var(--primary-text)] hover:bg-[var(--primary-hover)]">

// ボーダー
<div className="border border-[var(--border)]">
```

### TypeScriptで使用する（将来的に）

```typescript
import { colors, darkColors, getThemeColors } from '@/theme/colors';

// ライトモードの色を取得
const lightColors = getThemeColors('light');

// ダークモードの色を取得
const darkColors = getThemeColors('dark');
```

## 利用可能な色

### 基本色

- `--background`: メイン背景色
- `--background-secondary`: セカンダリー背景色
- `--text`: メインテキスト色
- `--text-muted`: ミュートされたテキスト色
- `--text-light`: ライトテキスト色
- `--text-black`: 黒テキスト色

### アクションカラー

- `--primary`: プライマリーカラー（メインアクション）
- `--primary-hover`: プライマリーカラー（ホバー時）
- `--primary-text`: プライマリーボタンのテキスト色
- `--secondary`: セカンダリーカラー（アクセント）
- `--secondary-hover`: セカンダリーカラー（ホバー時）
- `--secondary-text`: セカンダリーボタンのテキスト色

### UI要素

- `--border`: 通常のボーダー色
- `--border-dark`: ダークボーダー色
- `--overlay`: オーバーレイ色（薄い）
- `--overlay-dark`: オーバーレイ色（濃い）

### ステータスカラー

- `--success`: 成功色
- `--error`: エラー色
- `--error-dark`: エラー色（濃い）
- `--warning`: 警告色
- `--info`: 情報色

### 管理者用カラー

- `--admin-delete`: 削除ボタン色
- `--admin-delete-hover`: 削除ボタン色（ホバー時）
- `--admin-remove`: 削除ボタン色
- `--admin-remove-hover`: 削除ボタン色（ホバー時）
- `--admin-audio-en`: 英語音声削除ボタン色
- `--admin-audio-en-hover`: 英語音声削除ボタン色（ホバー時）
- `--admin-audio-en-reply`: 英語返答音声削除ボタン色
- `--admin-audio-en-reply-hover`: 英語返答音声削除ボタン色（ホバー時）
- `--admin-audio-ja`: 日本語返答音声削除ボタン色
- `--admin-audio-ja-hover`: 日本語返答音声削除ボタン色（ホバー時）

## ダークモード対応

現在、ダークモードの実装は準備段階です。`src/theme/colors.ts`にダークモード用の色定義が用意されており、将来的に以下の手順で実装できます：

1. ユーザーのテーマ設定を保存するstateを作成
2. `src/app/globals.css`の`@media (prefers-color-scheme: dark)`セクションを更新
3. テーマ切り替えUIを`src/components/settings/settings-menu.tsx`に追加

## 新しい色の追加

新しい色を追加する場合は、以下の3箇所を更新してください：

1. `src/theme/colors.ts` - `lightColors`と`darkColors`に色を追加
2. `src/theme/colors.ts` - `ColorTheme`型に色を追加
3. `src/app/globals.css` - `:root`セクションにCSS変数を追加
4. `src/app/globals.css` - `@theme inline`セクションに対応するTailwind変数を追加

## 注意事項

- **ハードコードされた色は使用しない**: `#2f8f9d`や`bg-blue-500`などのハードコードされた色の代わりに、必ずCSS変数を使用してください
- **一貫性を保つ**: 新しいコンポーネントを作成する際は、既存の色変数を使用してください
- **アクセシビリティ**: 色のコントラスト比を確認し、WCAG AAレベル以上を目指してください
