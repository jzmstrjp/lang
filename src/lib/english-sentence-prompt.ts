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

const THIRD_PERSON_PATTERN = /\b(she|he|they|her|his|him|them)\b/i;

export function hasThirdPerson(text: string): boolean {
  return THIRD_PERSON_PATTERN.test(text);
}

export function buildThirdPersonNote(senderName: string, receiverName: string): string {
  return `※英文中の she/he/they/her/his/him/them 等の三人称は、${senderName}・${receiverName} のどちらでもない第三者を指します。`;
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
  senderName,
  receiverName,
}: {
  phrase: string;
  voice: Voice;
  how: How;
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
  usedSentences: string[];
  category: PhraseCategory;
  additionalInstruction?: string;
  includeJapaneseSentence?: boolean;
  senderName: string;
  receiverName: string;
}): string {
  const usedBlock =
    usedSentences.length > 0
      ? `\n以下の英文はすでに作成済みです。これらと被らない英文の台詞を作成してください。\n${usedSentences.map((s) => `- ${s}`).join('\n')}\n`
      : '';
  const thirdPersonNote = hasThirdPerson(phrase)
    ? `${buildThirdPersonNote(senderName, receiverName)}\n`
    : '';

  return `
${usedBlock}

「${phrase}」というフレーズを使って、ある人が誰かに${how}で話しかけるとしたら、どんなシチュエーションでどんな英文が自然にあり得ますか？
${thirdPersonNote}${pickAdjectiveWord(category)}を1つ作成してください。「${phrase}」というフレーズならではの台詞にしてください。
${additionalInstruction ? additionalInstruction + '\n' : ''}
いつ・どこで・誰が・何がきっかけで・誰に・何を求めて話しかけたのか、そのsituationも作成してください（シチュエーションは日本語1文で説明してください）
現実によくあるような自然なシチュエーションにしてください。
5W1Hを省略せずにシチュエーションを記述してください。人物は全て役割と個人名を書いてください。
（シチュエーションの例: 長女のアスカが学校に出掛けた後、母親のミサトは家の玄関にアスカのカバンが置き忘れてあることに気づいたので、アスカのカバンを届けるように息子のタカシに対面で話しかけた）
※フレーズ内のS・V・O などは、それぞれ実際の Subject（主語）・Verb（動詞）・Object（目的語）などに置き換えてください。
※話しかける人は${senderName}（${voiceMap[voice]}）、話しかけられる人は${receiverName}（${voiceMap[toggleVoice(voice)]}）です。
${phrase.includes(' ') ? '指定されたフレーズが慣用句の場合は、文字通りの意味で使わず慣用句として使ってください。' : ''}
英文法は正確に、文法の間違いがないようにしてください。
シチュエーション抜きで英語の台詞だけ読んでもある程度の状況が分かるような台詞にしてください。
${rule.min}語以上${rule.max}語以下の英文を作成してください。

${'note' in rule ? rule.note : ''}
${howNoteMap[how]}

【重要】以下のJSON形式で出力してください。

\`\`\`json
{
  "englishSentence": "（作成した英文の台詞）",${includeJapaneseSentence ? '\n  "japaneseSentence": "（英文の自然な日本語訳・カタカナ英語は禁止）",' : ''}
  "situation": "（いつ・どこで・何がきっかけで・誰が・誰に・何を求めて話しかけたのかを日本語1文で説明）"
}
\`\`\`
  `;
}
