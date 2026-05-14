import { WORD_COUNT_RULES } from '@/config/problem';

export type Voice = 'male' | 'female';
export type How = '対面' | '電話';
export type PhraseCategory = 'business' | 'casual';

export const voiceMap: Record<Voice, string> = {
  male: '男性',
  female: '女性',
};

export const toggleVoice = (voice: Voice): Voice => (voice === 'male' ? 'female' : 'male');

export const howNoteMap: Record<How, string> = {
  対面: '',
  電話: '電話なので、お互いに相手のことは見えません。二人は別々の離れた場所にいます。',
};

const casualAdjectiveWords = ['ネイティブが実際に会話で使うような、ごく自然な英文の台詞'] as const;
const businessAdjectiveWords = [
  'ネイティブが実際に会話で使うような、ごく自然な英文の台詞',
] as const;

export function pickAdjectiveWord(category: PhraseCategory): string {
  const list = category === 'business' ? businessAdjectiveWords : casualAdjectiveWords;
  return list[Math.floor(Math.random() * list.length)]!;
}

export function buildEnglishSentenceOnlyPrompt({
  phrase,
  voice,
  how,
  rule,
  usedSentences,
  category,
  additionalInstruction = '',
  includeJapaneseSentence = false,
}: {
  phrase: string;
  voice: Voice;
  how: How;
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
  usedSentences: string[];
  category: PhraseCategory;
  additionalInstruction?: string;
  includeJapaneseSentence?: boolean;
}): string {
  const usedBlock =
    usedSentences.length > 0
      ? `\n以下の英文はすでに作成済みです。これらと被らない英文の台詞を作成してください。\n${usedSentences.map((s) => `- ${s}`).join('\n')}\n`
      : '';

  return `
${usedBlock}

「${phrase}」というフレーズを使って、ある人が誰かに${how}で話しかけるとしたら、どんなシチュエーションでどんな英文があり得ますか？
${pickAdjectiveWord(category)}を1つ作成してください。${additionalInstruction ? additionalInstruction + '\n' : ''}
いつ・どこで・誰が・何がきっかけで・誰に・何を求めて話しかけたのか、そのsituationも作成してください（シチュエーションは日本語1文で説明してください）
現実によくあるような自然なシチュエーションにしてください。
5W1Hを省略せずにシチュエーションを記述してください。
（シチュエーションの例: 息子が学校に出掛けた後、母親が、家の玄関で、息子のカバンが置いてあることに気づき、取りに帰ってきて欲しくて、電話で息子に連絡した）
※フレーズ内のS・V・O などは、それぞれ実際の Subject（主語）・Verb（動詞）・Object（目的語）などに置き換えてください。
※話しかける人は${voiceMap[voice]}、話しかけられる人は${voiceMap[toggleVoice(voice)]}です。
${phrase.includes(' ') ? '指定されたフレーズが慣用句の場合は、文字通りの意味で使わず慣用句として使ってください。' : ''}
英文法は正確に、文法の間違いがないようにしてください。
シチュエーション抜きで英語の台詞だけ読んでもある程度の状況が分かるような台詞にしてください。
${rule.min}語以上${rule.max}語以下の英文を作成してください。

${'note' in rule ? rule.note : ''}
${howNoteMap[how]}

【重要】以下のJSON形式で出力してください。

\`\`\`json
{
  "englishSentence": "（作成した英文の台詞）",${includeJapaneseSentence ? '\n  "japaneseSentence": "（英文の自然な日本語訳）",' : ''}
  "situation": "（いつ・どこで・何がきっかけで・誰が・誰に・何を求めて話しかけたのかを日本語1文で説明）"
}
\`\`\`
  `;
}
