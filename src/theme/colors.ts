/**
 * アプリケーション全体で使用する色の定義
 * ダークモード対応のため、すべての色をここで一元管理
 */

export const lightColors = {
  // 背景色
  background: '#ffffff',
  backgroundSecondary: '#f4f1ea',

  // テキスト色
  text: '#2a2b3c',
  textMuted: '#666666',
  textLight: '#f4f1ea',
  textBlack: '#000000',

  // プライマリーカラー（メインアクション）
  primary: '#2f8f9d',
  primaryHover: '#257682',
  primaryText: '#f4f1ea',

  // セカンダリーカラー（アクセント）
  secondary: '#d77a61',
  secondaryHover: '#c3684f',
  secondaryText: '#f4f1ea',

  // ボーダーとシャドウ
  border: '#d8cbb6',
  borderDark: '#2a2b3c',

  // ステータスカラー
  success: '#0ea5e9', // cyan-600相当
  error: '#f43f5e', // rose-500相当
  errorDark: '#e11d48', // rose-600相当
  warning: '#eab308',
  info: '#3b82f6',

  // オーバーレイ
  overlay: 'rgba(0, 0, 0, 0.1)',
  overlayDark: 'rgba(0, 0, 0, 0.5)',

  // 管理者用カラー
  adminDelete: '#b91c1c', // red-700
  adminDeleteHover: '#dc2626', // red-600
  adminRemove: '#dc2626', // rose-600
  adminRemoveHover: '#ef4444', // rose-500
  adminAudioEn: '#0284c7', // sky-600
  adminAudioEnHover: '#0ea5e9', // sky-500
  adminAudioEnReply: '#4f46e5', // indigo-600
  adminAudioEnReplyHover: '#6366f1', // indigo-500
  adminAudioJa: '#059669', // emerald-600
  adminAudioJaHover: '#10b981', // emerald-500

  // ヘッダー
  headerBorder: '#1f2937', // gray-800
} as const;

// ダークモード用の色（今後実装）
export const darkColors = {
  // 背景色
  background: '#1a1b26',
  backgroundSecondary: '#24283b',

  // テキスト色
  text: '#c0caf5',
  textMuted: '#9aa5ce',
  textLight: '#f4f1ea',
  textBlack: '#ffffff',

  // プライマリーカラー（メインアクション）
  primary: '#7dcfff',
  primaryHover: '#b4f9f8',
  primaryText: '#1a1b26',

  // セカンダリーカラー（アクセント）
  secondary: '#f7768e',
  secondaryHover: '#ff9e64',
  secondaryText: '#1a1b26',

  // ボーダーとシャドウ
  border: '#414868',
  borderDark: '#565f89',

  // ステータスカラー
  success: '#9ece6a',
  error: '#f7768e',
  errorDark: '#ff9e64',
  warning: '#e0af68',
  info: '#7aa2f7',

  // オーバーレイ
  overlay: 'rgba(0, 0, 0, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',

  // 管理者用カラー
  adminDelete: '#f7768e',
  adminDeleteHover: '#ff9e64',
  adminRemove: '#f7768e',
  adminRemoveHover: '#ff9e64',
  adminAudioEn: '#7dcfff',
  adminAudioEnHover: '#b4f9f8',
  adminAudioEnReply: '#bb9af7',
  adminAudioEnReplyHover: '#c0caf5',
  adminAudioJa: '#9ece6a',
  adminAudioJaHover: '#b4f9f8',

  // ヘッダー
  headerBorder: '#414868',
} as const;

export type ColorTheme = {
  background: string;
  backgroundSecondary: string;
  text: string;
  textMuted: string;
  textLight: string;
  textBlack: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  secondary: string;
  secondaryHover: string;
  secondaryText: string;
  border: string;
  borderDark: string;
  success: string;
  error: string;
  errorDark: string;
  warning: string;
  info: string;
  overlay: string;
  overlayDark: string;
  adminDelete: string;
  adminDeleteHover: string;
  adminRemove: string;
  adminRemoveHover: string;
  adminAudioEn: string;
  adminAudioEnHover: string;
  adminAudioEnReply: string;
  adminAudioEnReplyHover: string;
  adminAudioJa: string;
  adminAudioJaHover: string;
  headerBorder: string;
};

/**
 * 現在のテーマを取得（将来的にダークモード対応）
 */
export function getThemeColors(theme: 'light' | 'dark' = 'light'): ColorTheme {
  return theme === 'dark' ? darkColors : lightColors;
}

// デフォルトはライトモード
export const colors = lightColors;
