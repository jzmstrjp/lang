import type { ImageGenerateParams } from 'openai/resources/images';
import type { ChatModel } from 'openai/resources/shared';

export const TEXT_MODEL_RICH_SCENE: ChatModel = 'gpt-4.1';
export const TEXT_MODEL_QUICK: ChatModel = 'gpt-4.1';

export const IMAGE_MODEL_SETTING = {
  model: 'gpt-image-2',
  size: '1024x1536',
  quality: 'low',
} as const satisfies Omit<ImageGenerateParams, 'prompt'>;

export const appearanceTypeMap = {
  male: [
    '爽やかな感じ。',
    '王道な感じ。',
    '塩顔な感じ。',
    '色気ある感じ。',
    '優しそうな感じ。',
    '知的な感じ。',
    'ワイルドな感じ。',
    '上品な感じ。',
  ],
  female: [
    '清楚な感じ。',
    '可愛い感じ。',
    '美人な感じ。',
    '色気ある感じ。',
    '爽やかな感じ。',
    'お姉さんな感じ。',
  ],
} as const;

// 1回で取得する問題数（2フレーズ × 2問）
export const PROBLEM_FETCH_LIMIT = 4;
// expression グルーピング取得時の設定
export const EXPRESSION_FETCH_PHRASES = 2;
export const EXPRESSION_FETCH_PER_PHRASE = 2;

const HOST_NAME = 'xn--w8jtfrbw831dz9h.xn--sssu80k.dev';

export const SITE_ORIGIN = `https://${HOST_NAME}`;
export const CDN_ORIGIN = `https://cdn.${HOST_NAME}`;

/** DB に入っているパス（先頭 / あってもよい）を CDN の URL にする */
export function cdnUrl(path: string): string {
  const p = path.replace(/^\/+/, '');
  return `${CDN_ORIGIN}/${p}`;
}

// 連続正解のシェア対象となるcount値
export const ALLOWED_SHARE_COUNTS = [
  5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 400, 500,
] as const;
