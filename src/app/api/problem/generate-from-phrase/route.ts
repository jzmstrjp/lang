import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { TEXT_MODEL_1, TEXT_MODEL_2 } from '@/const';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import {
  buildEnglishSentenceOnlyPrompt,
  voiceMap,
  toggleVoice,
  type Voice,
  type How,
} from '@/lib/english-sentence-prompt';
import { buildSceneInfoPrompt, type SceneInfo } from '@/lib/scene-info-prompt';
import { buildJapaneseConversationRules } from '@/lib/problem-generator';
import { buildSceneText } from '@/lib/scene-utils';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GENERATE_COUNT = 3;

async function generateOne(params: {
  phrase: string;
  phraseJa: string;
  voice: Voice;
  how: How;
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
  additionalInstruction: string;
  usedSentences: string[];
}): Promise<{ scene: SceneInfo; japaneseSentence: string; prompt: string } | null> {
  const senderName = params.voice === 'male' ? 'タカシ' : 'アカリ';
  const receiverName = params.voice === 'male' ? 'アカリ' : 'タカシ';

  // 1回目: 英文のみ生成
  const sentencePrompt = buildEnglishSentenceOnlyPrompt({
    ...params,
    senderName,
    receiverName,
  });

  const sentenceResponse = await openai.chat.completions.create({
    model: TEXT_MODEL_1,
    messages: [{ role: 'user', content: sentencePrompt }],
    temperature: 0.7,
  });

  const sentenceRaw = sentenceResponse.choices[0]?.message.content?.trim() ?? '';
  const englishSentence = sentenceRaw.replace(/^```[\w]*\n?|```$/g, '').trim();
  if (!englishSentence) return null;

  // 2回目: シーン情報を生成
  const scenePrompt = buildSceneInfoPrompt({
    senderName,
    receiverName,
    englishSentence,
    voice: params.voice,
    how: params.how,
  });

  const sceneResponse = await openai.chat.completions.create({
    model: TEXT_MODEL_1,
    messages: [{ role: 'user', content: scenePrompt }],
    temperature: 0.7,
  });

  const sceneRaw = sceneResponse.choices[0]?.message.content?.trim() ?? '';
  const jsonMatch = sceneRaw.match(/```json\n([\s\S]*?)```/);
  if (!jsonMatch?.[1]) return null;

  const scene = JSON.parse(jsonMatch[1]) as SceneInfo;
  const fullScene: SceneInfo = { ...scene, englishSentence, how: params.how };

  // 3回目: 日本語訳を生成
  const translatePrompt = `【翻訳すべき英文】
${englishSentence}

${buildJapaneseConversationRules({
  senderName,
  senderRole: scene.senderRole,
  senderGender: voiceMap[params.voice],
  receiverName,
  receiverRole: scene.receiverRole,
  receiverGender: voiceMap[toggleVoice(params.voice)],
  englishSentence,
  englishReply: '',
  how: params.how,
  translate: 'sender',
})}

【シーン情報】
${buildSceneText({
  how: params.how,
  senderWhen: scene.when,
  place: scene.where,
  senderRole: scene.senderRole,
  senderName,
  senderVoice: params.voice === 'male' ? 'male' : 'female',
  receiverPlace: scene.receiverWhere,
  receiverRole: scene.receiverRole,
  receiverName: scene.receiverName,
  receiverVoice: params.voice === 'male' ? 'female' : 'male',
  senderWhy: scene.why,
  senderWant: scene.want,
})}

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
{
  "japanese": "ここに翻訳結果の日本語が入る。"
}
\`\`\``;

  const translateResponse = await openai.chat.completions.create({
    model: TEXT_MODEL_2,
    messages: [{ role: 'user', content: translatePrompt }],
    temperature: 0.3,
  });

  const translateRaw = translateResponse.choices[0]?.message.content?.trim() ?? '';
  const translateJsonMatch = translateRaw.match(/```json\n([\s\S]*?)```/);
  const japaneseSentence = translateJsonMatch?.[1]
    ? (JSON.parse(translateJsonMatch[1]) as { japanese: string }).japanese
    : translateRaw;

  return { scene: fullScene, japaneseSentence, prompt: sentencePrompt };
}

export async function POST(req: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      phrase?: string;
      phraseJa?: string;
      additionalInstruction?: string;
      type?: ProblemLength;
      voice?: Voice;
      how?: How;
    };

    const phrase = body.phrase?.trim();
    if (!phrase) {
      return NextResponse.json({ error: 'phrase は必須です。' }, { status: 400 });
    }
    const phraseJa = body.phraseJa?.trim() ?? '';

    const type = body.type ?? 'short';
    const rule = WORD_COUNT_RULES[type];
    if (!rule) {
      return NextResponse.json({ error: `無効な type: ${type}` }, { status: 400 });
    }

    const voice: Voice = body.voice ?? (['male', 'female'] as const)[Math.floor(Math.random() * 2)];
    const how: How = body.how ?? (['対面', '電話'] as const)[Math.floor(Math.random() * 2)];
    const additionalInstruction = body.additionalInstruction?.trim() ?? '';

    // GENERATE_COUNT件を順番に生成（usedSentencesで被りを防ぐ）
    const rawResults: { scene: SceneInfo; japaneseSentence: string; prompt: string }[] = [];
    for (let i = 0; i < GENERATE_COUNT; i++) {
      const usedSentences = rawResults.map((r) => r.scene.englishSentence);
      const result = await generateOne({
        phrase,
        phraseJa,
        voice,
        how,
        rule,
        additionalInstruction,
        usedSentences,
      });
      if (result) rawResults.push(result);
    }

    const results = rawResults.map(({ scene, japaneseSentence }) => ({
      englishSentence: scene.englishSentence,
      japaneseSentence,
      senderName: scene.senderName,
      senderRole: scene.senderRole,
      receiverName: scene.receiverName,
      receiverRole: scene.receiverRole,
      when: scene.when,
      where: scene.where,
      receiverWhere: scene.receiverWhere,
      why: scene.why,
      want: scene.want,
      how: scene.how,
    }));

    return NextResponse.json({ results, prompt: rawResults.at(-1)?.prompt ?? '' });
  } catch (error) {
    console.error('[generate-from-phrase] error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
