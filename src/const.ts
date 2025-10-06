import type { ImageGenerateParams } from 'openai/resources/images';

export const MODEL_SETTING = {
  model: 'gpt-image-1',
  size: '1024x1536',
  quality: 'medium',
} as const satisfies Omit<ImageGenerateParams, 'prompt'>;

// 1回で取得する問題数
export const PROBLEM_FETCH_LIMIT = 10;

// 連続正解のシェア対象となるcount値
export const ALLOWED_SHARE_COUNTS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
