import type { ImageGenerateParams } from 'openai/resources/images';

export const MODEL_SETTING = {
  model: 'gpt-image-1',
  size: '1024x1536',
  quality: 'medium',
} as const satisfies Omit<ImageGenerateParams, 'prompt'>;
