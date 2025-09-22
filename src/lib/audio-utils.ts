import OpenAI from 'openai';
import { config } from 'dotenv';

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

function speakerToVoice(speaker: 'male' | 'female' | 'neutral'): string {
  switch (speaker) {
    case 'male':
      return 'echo';
    case 'female':
      return 'nova';
    default:
      return 'alloy';
  }
}

export async function generateSpeech(input: string, speaker: 'male' | 'female' | 'neutral') {
  ensureApiKey();

  const voice = speakerToVoice(speaker);

  const result = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input,
  });

  const arrayBuffer = await result.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}
