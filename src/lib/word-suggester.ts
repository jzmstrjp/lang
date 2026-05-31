import { OpenAI } from 'openai';
import { TEXT_MODEL_RICH_SCENE } from '@/const';
import { recordTokenUsage } from '@/lib/token-usage-tracker';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** kids 用の固定フレーズテンプレ（___ は問題生成時に語彙が入る） */
export const KIDS_WORD_TEMPLATES: { expression: string; expressionJa: string }[] = [
  {
    expression: 'Can I borrow your ___?',
    expressionJa: 'あなたの___を借りてもいい？',
  },
  {
    expression: 'Can I use your ___?',
    expressionJa: 'あなたの___を使ってもいい？',
  },
  {
    expression: 'Can I see your ___?',
    expressionJa: 'あなたの___を見てもいい？',
  },
  {
    expression: 'Can I try this ___?',
    expressionJa: 'この___を試してもいい？',
  },
  {
    expression: 'Can I have this ___?',
    expressionJa: 'この___をもらってもいい？',
  },
  {
    expression: 'Can I take this ___?',
    expressionJa: 'この___を取ってもいい？',
  },
  {
    expression: 'Can I eat this ___?',
    expressionJa: 'この___を食べてもいい？',
  },
  {
    expression: 'Can I drink this ___?',
    expressionJa: 'この___を飲んでもいい？',
  },
  {
    expression: 'Can you pass me the ___?',
    expressionJa: 'その___を取ってくれる？',
  },
  {
    expression: 'Can you show me your ___?',
    expressionJa: 'あなたの___を見せてくれる？',
  },
  {
    expression: 'Can you teach me this ___?',
    expressionJa: 'この___を教えてくれる？',
  },
  {
    expression: 'Can you help me with this ___?',
    expressionJa: 'この___を手伝ってくれる？',
  },
  {
    expression: 'Do you have a ___?',
    expressionJa: '___を持っている？',
  },
  {
    expression: 'Do you have any ___?',
    expressionJa: '___はありますか？',
  },
  {
    expression: 'Do you know this ___?',
    expressionJa: 'この___を知っている？',
  },
  {
    expression: 'Do you like this ___?',
    expressionJa: 'この___は好き？',
  },
  {
    expression: 'Do you want this ___?',
    expressionJa: 'この___がほしい？',
  },
  {
    expression: 'Do you want to try this ___?',
    expressionJa: 'この___を試してみたい？',
  },
  {
    expression: 'Do you want to eat this ___?',
    expressionJa: 'この___を食べたい？',
  },
  {
    expression: 'Do you want to drink this ___?',
    expressionJa: 'この___を飲みたい？',
  },
  {
    expression: 'Do you want to play this ___?',
    expressionJa: 'この___で遊びたい？',
  },
  {
    expression: 'Do you want to watch this ___?',
    expressionJa: 'この___を見たい？',
  },
  {
    expression: 'Do you want to buy this ___?',
    expressionJa: 'この___を買いたい？',
  },
  {
    expression: 'Are you looking for your ___?',
    expressionJa: 'あなたの___を探しているの？',
  },
  {
    expression: 'Are you good at ___?',
    expressionJa: '___は得意？',
  },
  {
    expression: 'Are you ready for the ___?',
    expressionJa: 'その___の準備はできている？',
  },
  {
    expression: 'Is this your ___?',
    expressionJa: 'これはあなたの___？',
  },
  {
    expression: 'Is that your ___?',
    expressionJa: 'あれはあなたの___？',
  },
  {
    expression: 'Is the ___ near here?',
    expressionJa: 'その___はこの近くにある？',
  },
  {
    expression: 'Is this ___ expensive?',
    expressionJa: 'この___は高い？',
  },
  {
    expression: 'Is this ___ difficult?',
    expressionJa: 'この___は難しい？',
  },
  {
    expression: 'Is this ___ fun?',
    expressionJa: 'この___は楽しい？',
  },
  {
    expression: 'Where is my ___?',
    expressionJa: '私の___はどこ？',
  },
  {
    expression: 'Where is the ___?',
    expressionJa: 'その___はどこ？',
  },
  {
    expression: 'Where can I buy this ___?',
    expressionJa: 'この___はどこで買える？',
  },
  {
    expression: 'Where can I find the ___?',
    expressionJa: 'その___はどこで見つかる？',
  },
  {
    expression: 'Where should I put this ___?',
    expressionJa: 'この___をどこに置けばいい？',
  },
  {
    expression: 'When does the ___ start?',
    expressionJa: 'その___はいつ始まる？',
  },
  {
    expression: 'What is this ___?',
    expressionJa: 'この___は何？',
  },
  {
    expression: 'What does this ___ mean?',
    expressionJa: 'この___はどういう意味？',
  },
  {
    expression: 'What do you think of this ___?',
    expressionJa: 'この___をどう思う？',
  },
  {
    expression: 'What kind of ___ do you like?',
    expressionJa: 'どんな___が好き？',
  },
  {
    expression: 'What is your favorite ___?',
    expressionJa: '好きな___は何？',
  },
  {
    expression: 'How much is this ___?',
    expressionJa: 'この___はいくらですか？',
  },
  {
    expression: 'How about this ___?',
    expressionJa: 'この___はどう？',
  },
  {
    expression: 'How was the ___?',
    expressionJa: 'その___はどうだった？',
  },
  {
    expression: 'I want this ___, please.',
    expressionJa: 'この___をください。',
  },
  {
    expression: 'I want to try this ___.',
    expressionJa: 'この___を試してみたい。',
  },
  {
    expression: 'I want to eat this ___.',
    expressionJa: 'この___を食べたい。',
  },
  {
    expression: 'I want to drink this ___.',
    expressionJa: 'この___を飲みたい。',
  },
  {
    expression: 'I want to play this ___.',
    expressionJa: 'この___で遊びたい。',
  },
  {
    expression: 'I want to watch this ___.',
    expressionJa: 'この___を見たい。',
  },
  {
    expression: 'I want to buy this ___.',
    expressionJa: 'この___を買いたい。',
  },
  {
    expression: 'I need my ___ for class.',
    expressionJa: '授業で私の___が必要です。',
  },
  {
    expression: 'I forgot my ___.',
    expressionJa: '私の___を忘れました。',
  },
  {
    expression: 'I lost my ___.',
    expressionJa: '私の___をなくしました。',
  },
  {
    expression: 'I found your ___.',
    expressionJa: 'あなたの___を見つけました。',
  },
  {
    expression: "I'm looking for my ___.",
    expressionJa: '私の___を探しています。',
  },
  {
    expression: 'I have a question about this ___.',
    expressionJa: 'この___について質問があります。',
  },
  {
    expression: 'I think this ___ is good.',
    expressionJa: 'この___はいいと思う。',
  },
  {
    expression: 'I think this ___ is fun.',
    expressionJa: 'この___は楽しいと思う。',
  },
  {
    expression: 'I think this ___ is difficult.',
    expressionJa: 'この___は難しいと思う。',
  },
  {
    expression: 'I like this ___ better.',
    expressionJa: 'この___のほうが好き。',
  },
  {
    expression: "I don't like this ___ very much.",
    expressionJa: 'この___はあまり好きじゃない。',
  },
  {
    expression: 'This ___ is good.',
    expressionJa: 'この___はいいね。',
  },
  {
    expression: 'This ___ is cute.',
    expressionJa: 'この___はかわいいね。',
  },
  {
    expression: 'This ___ is cool.',
    expressionJa: 'この___はかっこいいね。',
  },
  {
    expression: 'This ___ is too big.',
    expressionJa: 'この___は大きすぎる。',
  },
  {
    expression: 'This ___ is too small.',
    expressionJa: 'この___は小さすぎる。',
  },
  {
    expression: 'This ___ is too expensive.',
    expressionJa: 'この___は高すぎる。',
  },
  {
    expression: 'This ___ looks good.',
    expressionJa: 'この___はよさそう。',
  },
  {
    expression: 'That ___ looks good.',
    expressionJa: 'あの___はよさそう。',
  },
  {
    expression: "Let's try this ___.",
    expressionJa: 'この___を試してみよう。',
  },
  {
    expression: "Let's buy this ___.",
    expressionJa: 'この___を買おう。',
  },
  {
    expression: "Let's choose this ___.",
    expressionJa: 'この___を選ぼう。',
  },
  {
    expression: "Let's look for your ___.",
    expressionJa: 'あなたの___を探そう。',
  },
  {
    expression: "Let's share this ___.",
    expressionJa: 'この___を分けよう。',
  },
  {
    expression: "I'll take this ___.",
    expressionJa: 'この___にします。',
  },
  {
    expression: "I'll have this ___.",
    expressionJa: 'この___にします。',
  },
  {
    expression: 'Please give me the ___.',
    expressionJa: 'その___をください。',
  },
  {
    expression: 'Please show me the ___.',
    expressionJa: 'その___を見せてください。',
  },
  {
    expression: 'Please bring your ___.',
    expressionJa: 'あなたの___を持ってきてください。',
  },
  {
    expression: 'Could I get this ___?',
    expressionJa: 'この___をもらえますか？',
  },
  {
    expression: 'Could you help me find my ___?',
    expressionJa: '私の___を探すのを手伝ってくれますか？',
  },
  {
    expression: 'Excuse me, where is the ___?',
    expressionJa: 'すみません、その___はどこですか？',
  },
  {
    expression: 'Excuse me, do you have this ___?',
    expressionJa: 'すみません、この___はありますか？',
  },
  {
    expression: "I'm sorry about your ___.",
    expressionJa: 'あなたの___のこと、ごめんなさい。',
  },
  {
    expression: "That's a good ___.",
    expressionJa: 'それはいい___だね。',
  },
  {
    expression: "That's my favorite ___.",
    expressionJa: 'それは私のお気に入りの___です。',
  },
];

const commonPromptPrefix = (usedListText: string, sampleSentencesText: string) =>
  `英語リスニング学習アプリで使用する英単語やイディオムを100個生成してください。

- 名詞・動詞・形容詞・副詞・接続詞/接続副詞/群前置詞・イディオムを均等に作成してください。
- 返答のセリフではなく、誰かに話しかける口語文の中で使用する語彙です。
  - 明らかに返答向の語彙は生成しないでください。
    - 例
      - "of course"
      - "all right"

## 以下はすでに使用済みの英単語やイディオムです。重複は避けてください。
${usedListText}

## 既存問題の英文サンプル
以下のサンプルを見て、まだ登場していない英単語やイディオムを生成してください。

${sampleSentencesText}
`;

const nonKidsRules = `## 提案ルール
- 日常生活系・ビジネス系の語彙を半分ずつくらい生成してください。
- TOEICのListening（口語）によく出るものを優先して生成してください。
- 日本人が知らなそうな難しめのビジネス英語上級語彙も3割程度含めてください。
`;

const commonPromptSuffix = `
## 出力形式（JSON）
"words" キーに { "expression": string, "expressionJa": string } の配列を返してください。
- expression: 英語の単語・表現
- expressionJa: 日本語の意味（一つだけ書くこと）

### 生成例
{
  "words": [
    { "expression": "apologize", "expressionJa": "謝罪する" },
  ]
}
`;

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

function suggestKidsWords(
  existingExpressions: string[],
  existingWords: { expression: string; expressionJa: string; isKids: boolean }[],
): { expression: string; expressionJa: string }[] {
  const usedExpressions = new Set([
    ...existingWords.filter((w) => w.isKids).map((w) => w.expression),
    ...existingExpressions,
  ]);
  return KIDS_WORD_TEMPLATES.filter((t) => !usedExpressions.has(t.expression));
}

export async function suggestWordsForCategory(
  isKids: boolean,
  existingExpressions: string[],
  existingWords: { expression: string; expressionJa: string; isKids: boolean }[],
  sampleSentences: string[],
): Promise<{ words: { expression: string; expressionJa: string }[]; tokenUsage: TokenUsage }> {
  if (isKids) {
    return {
      words: suggestKidsWords(existingExpressions, existingWords),
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const usedFromWords = existingWords
    .filter((w) => !w.isKids)
    .map((w) => ({ expression: w.expression, expressionJa: w.expressionJa }));

  const usedFromProblemsOnly = existingExpressions.filter(
    (e) => !usedFromWords.some((w) => w.expression === e),
  );

  const usedListText = [
    ...usedFromProblemsOnly.map(
      (e) => `フレーズ（expression）: ${e}\n日本語の意味（expressionJa）: （不明）`,
    ),
    ...usedFromWords.map(
      (w) =>
        `フレーズ（expression）: ${w.expression}\n日本語の意味（expressionJa）: ${w.expressionJa}`,
    ),
  ].join('\n----------\n');

  const sampleSentencesText = sampleSentences.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `${commonPromptPrefix(usedListText, sampleSentencesText)}\n${nonKidsRules}\n${commonPromptSuffix}`;

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL_RICH_SCENE,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  recordTokenUsage('ワード補充(AI提案)', {
    input_tokens: response.usage?.prompt_tokens,
    output_tokens: response.usage?.completion_tokens,
    input_tokens_details: { cached_tokens: response.usage?.prompt_tokens_details?.cached_tokens },
  });

  const content = response.choices[0]?.message.content ?? '{"words":[]}';
  const parsed = JSON.parse(content) as { words?: { expression: string; expressionJa: string }[] };
  return {
    words: (parsed.words ?? []).filter((w) => w.expression && w.expressionJa),
    tokenUsage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
