import type { ImageGenerateParams } from 'openai/resources/images';
import type { ChatModel } from 'openai/resources/shared';

export const TEXT_MODEL: ChatModel = 'gpt-4.1';

export const IMAGE_MODEL_SETTING = {
  model: 'gpt-image-1.5',
  size: '1024x1536',
  quality: 'low',
} as const satisfies Omit<ImageGenerateParams, 'prompt'>;

// 1回で取得する問題数
export const PROBLEM_FETCH_LIMIT = 10;

// 連続正解のシェア対象となるcount値
export const ALLOWED_SHARE_COUNTS = [
  5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210,
  220, 230, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 340, 350, 360, 370, 380, 390, 400,
  410, 420, 430, 440, 450, 460, 470, 480, 490, 500,
] as const;
