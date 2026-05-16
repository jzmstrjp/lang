import OpenAI from 'openai';
import { config } from 'dotenv';
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

export function buildSenderVoiceInstruction({
  senderName,
  receiverName,
  senderRole,
  senderVoice,
  receiverRole,
  receiverVoice,
  why,
  when,
  want,
}: {
  senderName: string;
  receiverName: string;
  senderRole: string;
  senderVoice: '男性' | '女性';
  receiverRole: string;
  receiverVoice: '男性' | '女性';
  why: string;
  when: string;
  want: string;
}): string {
  const base = `${senderName}（${senderRole}・${senderVoice}）が${receiverName}（${receiverRole}・${receiverVoice}）に話しかける場面。`;
  const context = [`タイミング: ${when}`, `きっかけ: ${why}`, `期待: ${want}`]
    .filter(Boolean)
    .join('\n');
  return context ? `${base}\n${context}` : base;
}

export function buildReceiverVoiceInstruction({
  senderName,
  receiverName,
  senderRole,
  senderVoice,
  receiverRole,
  receiverVoice,
  englishSentence,
  englishReply,
  when,
}: {
  senderName: string;
  receiverName: string;
  senderRole: string;
  senderVoice: '男性' | '女性';
  receiverRole: string;
  receiverVoice: '男性' | '女性';
  englishSentence: string;
  englishReply: string;
  when: string;
}): string {
  const base = `${senderName}（${senderRole}・${senderVoice}）から「${englishSentence}」と話しかけられた${receiverName}（${receiverRole}・${receiverVoice}）が「${englishReply}」と返答する場面。`;
  const context = [`タイミング: ${when}`].filter(Boolean).join('\n');
  return context ? `${base}\n${context}` : base;
}

// 音声設定は src/config/voice.ts で一元管理されるようになりました
// この関数は後方互換性のために残していますが、新しいコードでは getVoiceFromGender を使用してください
function speakerToVoice(speaker: VoiceGender) {
  return getVoiceFromGender(speaker);
}

export async function generateSpeech(
  input: string,
  speaker: VoiceGender,
  language: 'en' | 'ja',
  instructions: string | null,
) {
  ensureApiKey();

  const voice = speakerToVoice(speaker);
  const model = getModelFromGenderAndLanguage(speaker);

  const result = await openai.audio.speech.create({
    model,
    voice,
    input,
    speed: TTS_CONFIG.speed,
    instructions: instructions ?? undefined,
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
): Promise<Buffer> {
  ensureApiKey();

  const voice = speakerToVoice(speaker);
  const model = getModelFromGenderAndLanguage(speaker);

  const result = await openai.audio.speech.create({
    model,
    voice,
    input,
    speed: TTS_CONFIG.speed,
    instructions: instructions ?? undefined,
  });

  const arrayBuffer = await result.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
