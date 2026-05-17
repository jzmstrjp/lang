import { WORD_COUNT_RULES } from '@/config/problem';

export type Voice = 'male' | 'female';
export type How = '対面' | '電話';
export type PhraseCategory = 'business' | 'casual';

export const voiceMap: Record<Voice, string> = {
  male: '男性',
  female: '女性',
};

export const toggleVoice = (voice: Voice): Voice => (voice === 'male' ? 'female' : 'male');

export const howNoteMap = {
  対面: '',
  電話: '電話なので、お互いに相手のことは見えません。二人は別々の離れた場所にいます。',
} as const satisfies Record<How, string>;

const casualAdjectiveWords = [
  'ネイティブが実際に会話で使うような、ごく自然な英語の口語文',
] as const;
const businessAdjectiveWords = [
  'ネイティブが実際に会話で使うような、ごく自然な英語の口語文',
] as const;

export function pickAdjectiveWord(category: PhraseCategory): string {
  const list = category === 'business' ? businessAdjectiveWords : casualAdjectiveWords;
  return list[Math.floor(Math.random() * list.length)]!;
}

const THIRD_PERSON_PATTERN = /\b(she|he|they|her|his|him|them)\b/gi;

export function buildThirdPersonNote(
  text: string,
  senderName: string,
  receiverName: string,
): string {
  const matched = [...new Set(text.match(THIRD_PERSON_PATTERN) ?? [])].join('・');
  if (!matched) return '';
  return `※フレーズ内の「${matched}」は ${senderName} でも ${receiverName} でもない第三者です。`;
}

export function buildEnglishSentenceOnlyPrompt({
  phrase,
  phraseJa,
  voice,
  how,
  rule,
  usedSentences,
  additionalInstruction = '',
  senderName,
  receiverName,
}: {
  phrase: string;
  phraseJa?: string;
  voice: Voice;
  how: How;
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
  usedSentences: string[];
  additionalInstruction?: string;
  senderName: string;
  receiverName: string;
}): string {
  const usedBlock =
    usedSentences.length > 0
      ? `以下の英文とは異なるシーンでの台詞を作成してください。\n${usedSentences.map((s) => `- ${s}`).join('\n')}\n\n`
      : '';
  const genderLabel = voiceMap[voice];
  const receiverGenderLabel = voiceMap[toggleVoice(voice)];
  const idiomNote = phrase.includes(' ')
    ? '指定されたフレーズが慣用句の場合は、文字通りの意味で使わず慣用句として使ってください。\n'
    : '';

  const notes = [
    additionalInstruction,
    idiomNote,
    howNoteMap[how],
    buildThirdPersonNote(phrase, senderName, receiverName),
  ]
    .filter(Boolean)
    .join('\n');

  return `
「${phrase}${phraseJa ? `（${phraseJa}）` : ''}」というフレーズを使って、現実世界で誰もが一度は聞いたことがあるような自然な英語の口語文を1つ作ってください。
${how}で誰かに話しかける口語文です。質問・依頼・意見・お気持ちなどです。

現実にありそうなシチュエーションにしてください。
英語ネイティブが聞いても違和感のない口語文にしてください。
英語の文法として確実に正しい口語文にしてください。
${'note' in rule ? `- ${rule.note}` : ''}
フレーズ内のS・V・O などは、それぞれ具体的な Subject（主語）・Verb（動詞）・Object（目的語）などに置き換えてください。
具体的な状況や情景が浮かぶような具体的な口語文にしてください。

${rule.min}語以上${rule.max}語以下の口語文にしてください。
ちなみに、話者の名前は${senderName}です。${genderLabel}です。
相手の名前は${receiverName}。${receiverGenderLabel}です。
特に必要なければ、英文の中で相手の名前を呼びかけないでください。（呼びかけた方が自然な場合は呼びかけてください）
${notes ? `【注意】\n${notes}\n` : ''}

${usedBlock}
【重要】英語の口語文のみを出力してください。JSONや説明は不要です。
`;
}
