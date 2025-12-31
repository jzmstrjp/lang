import OpenAI from 'openai';
import { config } from 'dotenv';
import { uploadAudioToR2 } from './r2-client';
import {
  getVoiceFromGender,
  getModelFromGenderAndLanguage,
  TTS_CONFIG,
  type VoiceGender,
} from '../config/voice';

// 環境変数を読み込み（シーダーから使用する場合のため）
if (typeof window === 'undefined') {
  config({ path: '.env' });
  config({ path: '.env.local' });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
}

function buildInstructions(instructions: string | null, role: string): string {
  return `${instructions ? instructions + '。' : ''}この人は${role}です。${role}らしい口調で話してください。`;
}

// 音声設定は src/config/voice.ts で一元管理されるようになりました
// この関数は後方互換性のために残していますが、新しいコードでは getVoiceFromGender を使用してください
function speakerToVoice(speaker: VoiceGender): string {
  return getVoiceFromGender(speaker);
}

export async function generateSpeech(
  input: string,
  speaker: VoiceGender,
  language: 'en' | 'ja',
  instructions: string | null,
  role: string,
) {
  ensureApiKey();

  const voice = speakerToVoice(speaker);
  const model = getModelFromGenderAndLanguage(speaker);

  const result = await openai.audio.speech.create({
    model,
    voice,
    input,
    speed: TTS_CONFIG.speed,
    instructions: buildInstructions(instructions, role),
  });

  const arrayBuffer = await result.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

/**
 * 音声を生成してBufferを返す（アップロードは別途実行）
 */
export async function generateSpeechBuffer(
  input: string,
  speaker: VoiceGender,
  language: 'en' | 'ja',
  instructions: string | null,
  role: string,
): Promise<Buffer> {
  ensureApiKey();

  const voice = speakerToVoice(speaker);
  const model = getModelFromGenderAndLanguage(speaker);

  const result = await openai.audio.speech.create({
    model,
    voice,
    input,
    speed: TTS_CONFIG.speed,
    instructions: buildInstructions(instructions, role),
  });

  const arrayBuffer = await result.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 音声を生成してR2にアップロード（レガシー関数、後で削除予定）
 */
export async function generateSpeechAndUploadToR2(
  input: string,
  speaker: VoiceGender,
  problemId: string,
  language: 'en' | 'ja',
  instructions: string | null,
  role: string,
): Promise<string> {
  const audioBuffer = await generateSpeechBuffer(input, speaker, language, instructions, role);
  return uploadAudioToR2(audioBuffer, problemId, language, speaker);
}
