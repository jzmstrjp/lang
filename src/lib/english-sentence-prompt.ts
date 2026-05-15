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

const casualAdjectiveWords = ['ネイティブが実際に会話で使うような、ごく自然な英文の台詞'] as const;
const businessAdjectiveWords = [
  'ネイティブが実際に会話で使うような、ごく自然な英文の台詞',
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
      ? `以下の英文はすでに作成済みです。これらと被らない英文の台詞を作成してください。\n${usedSentences.map((s) => `- ${s}`).join('\n')}\n\n`
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
    'note' in rule ? `- ${rule.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `あなたの名前は${senderName}。
${genderLabel}です。英語ネイティブです。

あなたが「${phrase}${phraseJa ? `（${phraseJa}）` : ''}」というフレーズを使って${how}で誰かに話しかけるとしたら、どんなセリフになりますか？

現実で言いそうな自然なセリフを教えてください。
英語の文法として正しいセリフにしてください。
フレーズ内のS・V・O などは、それぞれ実際の Subject（主語）・Verb（動詞）・Object（目的語）などに置き換えてください。
状況や情景が浮かぶようなセリフにしてください。

${rule.min}語以上${rule.max}語以下のセリフにしてください。
一応、相手の名前は${receiverName}。${receiverGenderLabel}です。
${Math.random() > 0.3 ? '冒頭で相手の名前を呼びかけないでください。' : '相手の名前を呼びかけたり、セリフの中に含めたりしてください。'}
${notes ? `【注意】\n${notes}\n` : ''}

${usedBlock}
【重要】英語のセリフのみを出力してください。JSONや説明は不要です。
`;
}
