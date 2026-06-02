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
  電話: '電話での会話なので、お互いに相手のことは見えません。二人は別々の離れた場所にいます。',
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
  isKids?: boolean;
}): string {
  const usedBlock =
    usedSentences.length > 0
      ? `以下の英文と全く同じ文は作成しないでください。ただし一部でも違っていればOKです。\n${usedSentences.map((s) => `- ${s}`).join('\n')}\n\n`
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

  const sentenceNote = 'sentenceNote' in rule ? rule.sentenceNote : undefined;

  return `
「${phrase}${phraseJa ? `（${phraseJa}）` : ''}」というフレーズを使って、現実世界で誰もが一度は聞いたことがあるような自然な英語の口語文を1つ作ってください。
${how}で誰かに話しかける口語文です。質問・依頼・意見・褒めたり叱ったり・お気持ちなどです。
何かに対する返答やリアクションではなく、話しかける内容です。（"Sounds good.", "Me too."などはリアクションなのでNGです）

現実にありそうなシチュエーションにしてください。
英語ネイティブが聞いても違和感のない口語文にしてください。
英語の文法として確実に正しい口語文にしてください。
${sentenceNote ? `- ${sentenceNote}` : ''}
フレーズ内のS・V・O などは、それぞれ具体的な Subject（主語）・Verb（動詞）・Object（目的語）などに置き換えてください。
このセリフだけ見れば、背景を知らなくても状況が分かるように作ってください。
そのまま画像を生成できるくらい、状況が浮かび上がる具体的な口語文にしてください。

${rule.min}語以上${rule.max}語以下の口語文にしてください。
ちなみに、話者の名前は${senderName}です。${genderLabel}です。
相手の名前は${receiverName}。${receiverGenderLabel}です。
${Math.random() < 0.83 ? '特に必要なければ、英文の中で相手の名前を呼びかけないでください。' : '冒頭で相手の名前を呼びかけるかどうかは、文の内容や相手との関係性によって決めてください。'}
${notes ? `【注意】\n${notes}\n` : ''}

${usedBlock}
【重要】以下のJSON形式のみを出力してください。

\`\`\`json
{
  "englishSentence": "作成した英語の口語文",
  "motivation": "${senderName}が${receiverName}に対して${how}でこの台詞を言った必然性・理由。最大40文字程度で簡潔に。",
  "senderRole": "${senderName}の職業・役割（最大10文字程度で簡潔に。性別は記載しないこと。）",
  "receiverRole": "${receiverName}は${senderName}にとってどんな相手か。${senderName}の〇〇、という形式で書くこと（例: ${senderName}の同僚、${senderName}の依頼する宅配便業者、${senderName}の知らない他人、など。最大15文字程度で簡潔に。性別は記載しないこと。）"
}
\`\`\`
`;
}
