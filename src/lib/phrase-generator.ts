import { OpenAI } from 'openai';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { buildEnglishReplyPrompt, buildJapaneseConversationRules } from '@/lib/problem-generator';
import { buildSceneText } from '@/lib/scene-utils';
import {
  type Voice,
  type How,
  voiceMap,
  toggleVoice,
  buildEnglishSentenceOnlyPrompt,
} from '@/lib/english-sentence-prompt';
import { buildSceneInfoPrompt, type SceneInfo } from '@/lib/scene-info-prompt';
import { TEXT_MODEL_RICH_SCENE, TEXT_MODEL_QUICK } from '@/const';

export type { Voice, How } from '@/lib/english-sentence-prompt';
export type { SceneInfo } from '@/lib/scene-info-prompt';

export const HOWS: How[] = ['対面', '対面', '電話'];

export type GenerateForPhraseResult = {
  englishSentence: string;
  englishReply: string;
  japaneseSentence: string;
  japaneseReply: string;
  senderName: string;
  senderRole: string;
  receiverName: string;
  receiverRole: string;
  when: string;
  where: string;
  receiverWhere: string;
  why: string;
  want: string;
  how: How;
  voice: Voice;
};

const maleNamesJapanese = [
  'ケン',
  'シンジ',
  'リョウタ',
  'タカシ',
  'ユウト',
  'アキラ',
  'ナオキ',
  'ショウタ',
  'ヒロ',
  'ユウキ',
] as const;

const maleNamesEnglish = [
  'ルーカス',
  'ジェームズ',
  'アレクサンダー',
  'ウィリアム',
  'ジャック',
  'ダニエル',
  'ライアン',
  'イーサン',
  'ノア',
  'セバスチャン',
] as const;

const femaleNamesJapanese = [
  'サクラ',
  'レイ',
  'アスカ',
  'ユイ',
  'ハナ',
  'ユウコ',
  'カナ',
  'ミオ',
  'レナ',
  'ユキ',
] as const;

const femaleNamesEnglish = [
  'エマ',
  'ソフィア',
  'クロエ',
  'ミア',
  'オリビア',
  'エヴァ',
  'シャーロット',
  'ルナ',
  'リリー',
  'マリア',
] as const;

const voiceNamesMap = {
  male: { japanese: maleNamesJapanese, english: maleNamesEnglish },
  female: { japanese: femaleNamesJapanese, english: femaleNamesEnglish },
} as const;

export const getRandomVoiceName = (voice: Voice, type: 'japanese' | 'english'): string => {
  return voiceNamesMap[voice][type][Math.floor(Math.random() * voiceNamesMap[voice][type].length)]!;
};

export async function createEnglishSentence(
  openai: OpenAI,
  {
    phrase,
    phraseJa,
    voice,
    how,
    rule,
    usedSentences = [],
    additionalInstruction = '',
    senderName,
    receiverName,
  }: {
    phrase: string;
    phraseJa: string;
    voice: Voice;
    how: How;
    rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
    usedSentences?: string[];
    additionalInstruction?: string;
    senderName: string;
    receiverName: string;
  },
): Promise<SceneInfo | null> {
  try {
    const sentencePrompt = buildEnglishSentenceOnlyPrompt({
      phrase,
      phraseJa,
      voice,
      how,
      rule,
      usedSentences,
      additionalInstruction,
      senderName,
      receiverName,
    });

    const sentenceResponse = await openai.responses.create({
      model: TEXT_MODEL_RICH_SCENE,
      input: [{ role: 'user', content: sentencePrompt }],
      temperature: 0.7,
    });

    const sentenceRaw = sentenceResponse.output_text?.trim();
    if (!sentenceRaw) throw new Error('英文レスポンスが空です');

    const englishSentence = sentenceRaw.replace(/^```[\w]*\n?|```$/g, '').trim();
    if (!englishSentence) throw new Error('英文が見つかりませんでした');

    const scenePrompt = buildSceneInfoPrompt({
      senderName,
      receiverName,
      englishSentence,
      voice,
      how,
      sceneNote: 'sceneNote' in rule ? rule.sceneNote : undefined,
    });

    const sceneResponse = await openai.responses.create({
      model: TEXT_MODEL_RICH_SCENE,
      input: [{ role: 'user', content: scenePrompt }],
      temperature: 0.7,
    });

    const sceneContent = sceneResponse.output_text;
    if (!sceneContent) throw new Error('シーン情報レスポンスが空です');

    const jsonMatch = sceneContent.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch?.[1]) throw new Error('JSON形式のレスポンスが見つかりませんでした');

    const scene = JSON.parse(jsonMatch[1]) as Omit<SceneInfo, 'englishSentence' | 'how'>;
    return { englishSentence, how, ...scene };
  } catch (e) {
    console.error('createEnglishSentence エラー:', e);
    return null;
  }
}

export async function createEnglishReply(
  openai: OpenAI,
  {
    sentence,
    senderName,
    receiverName,
    voice,
    isKids,
  }: {
    sentence: SceneInfo;
    senderName: string;
    receiverName: string;
    voice: Voice;
    isKids: boolean;
  },
): Promise<string | null> {
  const prompt =
    buildEnglishReplyPrompt({
      senderName,
      receiverName,
      who: sentence.senderRole,
      whom: sentence.receiverRole,
      senderGender: voiceMap[voice] as '男性' | '女性',
      receiverGender: voiceMap[toggleVoice(voice)] as '男性' | '女性',
      englishSentence: sentence.englishSentence,
      when: sentence.when,
      where: sentence.where,
      receiverPlace: sentence.receiverWhere,
      why: sentence.why,
      how: sentence.how,
      want: sentence.want,
      isKids,
    }) +
    `
【重要】英語の台詞のみを出力してください。JSONや説明は不要です。
`;

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL_RICH_SCENE,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = response.output_text?.trim();
    if (!content) throw new Error('レスポンスが空です');

    return content;
  } catch (e) {
    console.error('createEnglishReply エラー:', e);
    return null;
  }
}

export type JapaneseConversationResult = {
  japaneseSentence: string;
  japaneseReply: string;
};

export async function createJapaneseConversation(
  openai: OpenAI,
  {
    sentence,
    senderName,
    receiverName,
    englishReply,
    voice,
    how,
  }: {
    sentence: SceneInfo;
    senderName: string;
    receiverName: string;
    englishReply: string;
    voice: Voice;
    how: How;
  },
): Promise<JapaneseConversationResult | null> {
  const prompt = `
  【翻訳すべき英文】
  englishSentence: ${sentence.englishSentence}
  englishReply: ${englishReply}
  
  ${buildJapaneseConversationRules({
    senderRole: sentence.senderRole,
    senderName,
    senderGender: voiceMap[voice],
    receiverRole: sentence.receiverRole,
    receiverName,
    receiverGender: voiceMap[toggleVoice(voice)],
    englishSentence: sentence.englishSentence,
    englishReply,
    how,
  })}

【シーン情報】
${buildSceneText({
  senderName,
  receiverName,
  how,
  senderWhen: sentence.when,
  place: sentence.where,
  senderRole: sentence.senderRole,
  senderVoice: voice,
  receiverPlace: sentence.receiverWhere,
  receiverRole: sentence.receiverRole,
  receiverVoice: toggleVoice(voice),
  senderWhy: sentence.why,
  senderWant: sentence.want,
})}

以下のJSON形式で必ず回答してください。

\`\`\`json
{
  "japaneseSentence": "発言の日本語訳",
  "japaneseReply": "返答の日本語訳"
}
\`\`\`
  `;

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL_QUICK,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.output_text;
    if (!content) throw new Error('レスポンスが空です');

    const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch?.[1]) throw new Error('JSON形式のレスポンスが見つかりませんでした');

    return JSON.parse(jsonMatch[1]) as JapaneseConversationResult;
  } catch (e) {
    console.error('createJapaneseConversation エラー:', e);
    return null;
  }
}

export async function generateForPhrase(
  openai: OpenAI,
  {
    phrase,
    phraseJa,
    wordCountLength,
    voice,
    how,
    additionalInstruction = '',
    usedSentences = [],
  }: {
    phrase: string;
    phraseJa: string;
    wordCountLength: ProblemLength;
    voice: Voice;
    how: How;
    additionalInstruction?: string;
    usedSentences?: string[];
  },
): Promise<GenerateForPhraseResult | null> {
  const senderName = getRandomVoiceName(voice, 'japanese');
  const receiverName = getRandomVoiceName(toggleVoice(voice), 'english');

  const sentence = await createEnglishSentence(openai, {
    phrase,
    phraseJa,
    voice,
    how,
    rule: WORD_COUNT_RULES[wordCountLength],
    usedSentences,
    additionalInstruction,
    senderName,
    receiverName,
  });
  if (!sentence) return null;

  const englishReply = await createEnglishReply(openai, {
    sentence,
    voice,
    senderName,
    receiverName,
    isKids: wordCountLength === 'kids',
  });
  if (!englishReply) return null;

  const conversation = await createJapaneseConversation(openai, {
    sentence,
    senderName,
    receiverName,
    englishReply,
    voice,
    how,
  });
  if (!conversation) return null;

  return {
    englishSentence: sentence.englishSentence,
    englishReply,
    japaneseSentence: conversation.japaneseSentence,
    japaneseReply: conversation.japaneseReply,
    senderName,
    senderRole: sentence.senderRole,
    receiverName,
    receiverRole: sentence.receiverRole,
    when: sentence.when,
    where: sentence.where,
    receiverWhere: sentence.receiverWhere,
    why: sentence.why,
    want: sentence.want,
    how,
    voice,
  };
}
