/**
 * 音声設定の一元管理
 * OpenAI SDKの型を最大限活用した最小構成
 */

import type { SpeechCreateParams, SpeechModel } from 'openai/resources/audio/speech';

export type VoiceGender = 'male' | 'female' | 'neutral';

/**
 * 音声設定のマッピング
 */
export const VOICE_CONFIG = {
  male: 'echo',
  female: 'nova',
  neutral: 'alloy',
} as const satisfies Record<VoiceGender, SpeechCreateParams['voice']>;

/**
 * TTS共通設定
 */
export const TTS_CONFIG = {
  speed: 1.0,
  format: 'mp3',
} as const;

/**
 * 性別ごとのTTSモデル設定
 */
export const MODEL_CONFIG = {
  male: 'gpt-4o-mini-tts',
  female: 'gpt-4o-mini-tts',
  neutral: 'gpt-4o-mini-tts',
} as const satisfies Record<VoiceGender, SpeechModel>;

/**
 * 性別から音声設定を取得
 */
export function getVoiceFromGender(gender: VoiceGender): SpeechCreateParams['voice'] {
  return VOICE_CONFIG[gender];
}

export function getModelFromGender(gender: VoiceGender): SpeechModel {
  return MODEL_CONFIG[gender];
}
