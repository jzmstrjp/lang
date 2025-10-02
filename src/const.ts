import type { ImageGenerateParams } from 'openai/resources/images';

export const MODEL_SETTING = {
  model: 'gpt-image-1',
  size: '1024x1536',
  quality: 'medium',
} as const satisfies Omit<ImageGenerateParams, 'prompt'>;

// 1回で取得する問題数
export const PROBLEM_FETCH_LIMIT = 200;
