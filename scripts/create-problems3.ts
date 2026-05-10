import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import {
  TEXT_MODEL,
  // ENGLISH_REPLY_PROMPT_RULES,
  // JAPANESE_TRANSLATION_RULES,
  // TRANSLATION_FORMAT_RULES,
} from '@/const';
import { WORD_COUNT_RULES } from '@/config/problem';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Voice = 'male' | 'female';

const voiceMap: Record<Voice, string> = {
  male: '男性',
  female: '女性',
};

const toggleVoice = (voice: Voice) => {
  return voice === 'male' ? 'female' : 'male';
};

const createEnglishSentencePrompt = ({
  phrase,
  voice,
  how,
  rule,
}: {
  phrase: string;
  voice: Voice;
  how: '対面' | '電話';
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
}): string => {
  return `

「${phrase}」というフレーズを使って、ある${voiceMap[voice]}がある${voiceMap[toggleVoice(voice)]}に${how}で話しかけるとしたら、どんな英文があり得えますか？
ネイティブが実際に会話で使うような、ごく自然な英文の台詞を作成してください。
英文法は正確に、文法の間違いがないようにしてください。
${rule.min}語以上${rule.max}語以下の英文を作成してください。
いつ、どこで、誰が、誰に対して、何がきっかけで、どうなりたくてその台詞で話しかけるのかも書いてください。
この情報を元にAIが画像を作成できるほど具体的に書いてください。
whyやwantなしでenglishSentenceだけを読んでもある程度の状況が分かるように具体的な台詞にしてください。

以下のJSON形式で必ず回答してください。

\`\`\`json
${JSON.stringify(englishSentenceResultDifinition, null, 2)}
\`\`\`

## 例
${Object.entries(englishSentenceResultSamples)
  .map(
    ([key, sample]) =>
      `フレーズが「${key}」の場合:\n\`\`\`json\n${JSON.stringify(sample, null, 2)}\n\`\`\``,
  )
  .join('\n\n')}
  `;
};

type EnglishSentenceResult = {
  englishSentence: string;
  when: string;
  where: string;
  who: string;
  whom: string;
  why: string;
  want: string;
};

const englishSentenceResultDifinition: EnglishSentenceResult = {
  englishSentence: 'ここに英文が入る',
  when: 'いつ',
  where: 'どこで',
  who: '誰が',
  whom: '誰に対して',
  why: 'きっかけ',
  want: 'どうなりたい',
};

const englishSentenceResultSamples: Record<string, EnglishSentenceResult> = {
  'pass me the O': {
    englishSentence: 'Could you please pass me the salt?',
    when: '夕食前の調理中',
    where: 'キッチン',
    who: '夫',
    whom: '妻',
    why: '料理を作りたいが、塩が手元にない',
    want: '妻が塩を手元に持ってくれる',
  },
  'was I supposed to': {
    englishSentence: 'Which floor was I supposed to go to again?',
    when: 'エスカレーターで移動中',
    where: 'ショッピングモールのエスカレーター',
    who: '友人',
    whom: '友人',
    why: '目的の店が何階にあるのかを忘れてしまった',
    want: '相手が目的の店のフロアを教えてくれる',
  },
};

const createEnglishReply = async ({
  sentence,
  voice,
}: {
  sentence: EnglishSentenceResult;
  voice: Voice;
}): Promise<string | null> => {
  const prompt = `
  ${sentence.whom}（${voiceMap[toggleVoice(voice)]}）が、${sentence.who}（${voiceMap[voice]}）から「${sentence.englishSentence}」と話しかけられました。
  自然な返答のセリフを英語で作成してください。
  英文法は正確に、文法の間違いがないようにしてください。
  最初に自然な相槌や感嘆詞を入れてください。（例: I see, Oh, OK, Sure, I understand, I agree, Good, Thanks）
  簡潔な内容で、不要に話題を広げず、10語以内を目安に作成してください。

【シーン】
- いつ: ${sentence.when}
- どこで: ${sentence.where}

英語の台詞のみを出力してください。JSONや説明は不要です。
  `;

  // console.log(prompt);

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = response.output_text?.trim();
    if (!content) throw new Error('レスポンスが空です');

    return content;
  } catch (e) {
    console.error('エラー:', e);
    return null;
  }
};

type JapaneseConversationResult = {
  japaneseSentence: string;
  japaneseReply: string;
};

const createJapaneseConversation = async ({
  sentence,
  englishReply,
  voice,
}: {
  sentence: EnglishSentenceResult;
  englishReply: string;
  voice: Voice;
}): Promise<JapaneseConversationResult | null> => {
  const prompt = `
  ${sentence.who}（${voiceMap[voice]}）が「${sentence.englishSentence}」と話しかけ、
  ${sentence.whom}（${voiceMap[toggleVoice(voice)]}）が「${englishReply}」と返答しました。
  この会話を自然な日本語のセリフに翻訳してください。
  二人の関係性を考慮して、自然な口調のセリフに翻訳してください。
  英語に含まれる内容はできるだけ省略せずに日本語に翻訳してください。

【シーン】
- いつ: ${sentence.when}
- どこで: ${sentence.where}

以下のJSON形式で必ず回答してください。

\`\`\`json
{
  "japaneseSentence": "発言の日本語訳",
  "japaneseReply": "返答の日本語訳"
}
\`\`\`
  `;

  // console.log(prompt);

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.output_text;
    if (!content) throw new Error('レスポンスが空です');

    const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch?.[1]) throw new Error('JSON形式のレスポンスが見つかりませんでした');

    return JSON.parse(jsonMatch[1]) as JapaneseConversationResult;
  } catch (e) {
    console.error('エラー:', e);
    return null;
  }
};

const createEnglishSentence = async ({
  phrase,
  voice,
  how,
  rule,
}: {
  phrase: string;
  voice: Voice;
  how: '対面' | '電話';
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
}): Promise<EnglishSentenceResult | null> => {
  const prompt = createEnglishSentencePrompt({ phrase, voice, how, rule });

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = response.output_text;
    if (!content) throw new Error('レスポンスが空です');

    const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch?.[1]) throw new Error('JSON形式のレスポンスが見つかりませんでした');

    return JSON.parse(jsonMatch[1]) as EnglishSentenceResult;
  } catch (e) {
    console.error('エラー:', e);
    return null;
  }
};

const main = async () => {
  const prompt = createEnglishSentencePrompt({
    phrase: 'pass me the O',
    voice: 'male',
    how: '対面',
    rule: WORD_COUNT_RULES.short,
  });
  // console.log(prompt);

  const phrases = [
    'apple',
    'happy',
    'school',
    // 'travel',
    // 'important',
    // 'challenge',
    // 'efficient',
    // 'strategy',
    'negotiate',
    // 'stakeholder',
    'piece of cake',
    // 'break the ice',
    'hit the road',
    // 'under the weather',
    // 'once in a blue moon',
    // 'think outside the box',
    'on the same page',
    // 'get the ball rolling',
    'raise the bar',
    // 'win-win situation',
    'Rarely do + subject + verb ~',
    'Not only does + subject + verb ~',
    // 'The moment + subject + verb ~',
    'No sooner had + subject + past participle ~',
    'It is said that + subject + verb ~',
    // 'subject + make + object + complement',
    // 'subject + let + object + verb',
    // 'subject + have + object + past participle',
    // 'If I were you ~',
    // 'What + subject + verb + is ~',
  ];
  for (const phrase of phrases) {
    const result = await createEnglishSentence({
      phrase,
      voice: 'male',
      how: '対面',
      rule: WORD_COUNT_RULES.short,
    });
    console.log(result);
    // console.log(JSON.stringify(result, null, 2));
    const reply = await createEnglishReply({
      sentence: result!,
      voice: 'male',
    });
    // console.log(reply);
    const conversation = await createJapaneseConversation({
      sentence: result!,
      englishReply: reply!,
      voice: 'male',
    });
    console.log(conversation);
    console.log('--------------------------------');
  }
};

main();
