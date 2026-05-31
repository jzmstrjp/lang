import { OpenAI } from 'openai';
import { TEXT_MODEL_RICH_SCENE } from '@/const';
import { recordTokenUsage } from '@/lib/token-usage-tracker';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** kids 用の固定フレーズテンプレ（___ は問題生成時に語彙が入る） */
export const KIDS_WORD_TEMPLATES: { expression: string; expressionJa: string }[] = [
  {
    expression: 'Can I borrow your OBJECT?',
    expressionJa: 'あなたのOBJECTを借りてもいい？',
  },
  {
    expression: 'Can I use your OBJECT?',
    expressionJa: 'あなたのOBJECTを使ってもいい？',
  },
  {
    expression: 'Can I see your OBJECT?',
    expressionJa: 'あなたのOBJECTを見てもいい？',
  },
  {
    expression: 'Can I try this OBJECT?',
    expressionJa: 'このOBJECTを試してもいい？',
  },
  {
    expression: 'Can I have this OBJECT?',
    expressionJa: 'このOBJECTをもらってもいい？',
  },
  {
    expression: 'Can I take this OBJECT?',
    expressionJa: 'このOBJECTを取ってもいい？',
  },
  {
    expression: 'Can I eat this OBJECT?',
    expressionJa: 'このOBJECTを食べてもいい？',
  },
  {
    expression: 'Can I drink this OBJECT?',
    expressionJa: 'このOBJECTを飲んでもいい？',
  },
  {
    expression: 'Can I read this OBJECT?',
    expressionJa: 'このOBJECTを読んでもいい？',
  },
  {
    expression: 'Can I watch this OBJECT?',
    expressionJa: 'このOBJECTを見てもいい？',
  },
  {
    expression: 'Can I wear this OBJECT?',
    expressionJa: 'このOBJECTを着てもいい？',
  },
  {
    expression: 'Can I open the OBJECT?',
    expressionJa: 'そのOBJECTを開けてもいい？',
  },
  {
    expression: 'Can I close the OBJECT?',
    expressionJa: 'そのOBJECTを閉めてもいい？',
  },
  {
    expression: 'Can I move the OBJECT?',
    expressionJa: 'そのOBJECTを動かしてもいい？',
  },
  {
    expression: 'Can I sit on the OBJECT?',
    expressionJa: 'そのOBJECTに座ってもいい？',
  },
  {
    expression: 'Can I play with this OBJECT?',
    expressionJa: 'このOBJECTで遊んでもいい？',
  },
  {
    expression: 'Can I take a picture of your OBJECT?',
    expressionJa: 'あなたのOBJECTの写真を撮ってもいい？',
  },
  {
    expression: 'Can I put my OBJECT here?',
    expressionJa: '私のOBJECTをここに置いてもいい？',
  },
  {
    expression: 'Can I keep this OBJECT?',
    expressionJa: 'このOBJECTを持っていてもいい？',
  },
  {
    expression: 'Can I choose this OBJECT?',
    expressionJa: 'このOBJECTを選んでもいい？',
  },
  {
    expression: 'Can you pass me the OBJECT?',
    expressionJa: 'そのOBJECTを取ってくれる？',
  },
  {
    expression: 'Can you show me your OBJECT?',
    expressionJa: 'あなたのOBJECTを見せてくれる？',
  },
  {
    expression: 'Can you bring the OBJECT?',
    expressionJa: 'そのOBJECTを持ってきてくれる？',
  },
  {
    expression: 'Can you find my OBJECT?',
    expressionJa: '私のOBJECTを探してくれる？',
  },
  {
    expression: 'Can you help me find my OBJECT?',
    expressionJa: '私のOBJECTを探すのを手伝ってくれる？',
  },
  {
    expression: 'Can you help me carry this OBJECT?',
    expressionJa: 'このOBJECTを運ぶのを手伝ってくれる？',
  },
  {
    expression: 'Can you help me clean the OBJECT?',
    expressionJa: 'そのOBJECTを掃除するのを手伝ってくれる？',
  },
  {
    expression: 'Can you teach me this OBJECT?',
    expressionJa: 'このOBJECTを教えてくれる？',
  },
  {
    expression: 'Can you explain this OBJECT?',
    expressionJa: 'このOBJECTを説明してくれる？',
  },
  {
    expression: 'Can you check my OBJECT?',
    expressionJa: '私のOBJECTを確認してくれる？',
  },
  {
    expression: 'Do you have your OBJECT?',
    expressionJa: 'あなたのOBJECTを持っている？',
  },
  {
    expression: 'Do you need this OBJECT?',
    expressionJa: 'このOBJECTが必要？',
  },
  {
    expression: 'Do you want this OBJECT?',
    expressionJa: 'このOBJECTがほしい？',
  },
  {
    expression: 'Do you like this OBJECT?',
    expressionJa: 'このOBJECTは好き？',
  },
  {
    expression: 'Do you know this OBJECT?',
    expressionJa: 'このOBJECTを知っている？',
  },
  {
    expression: 'Do you remember this OBJECT?',
    expressionJa: 'このOBJECTを覚えている？',
  },
  {
    expression: 'Do you want to try this OBJECT?',
    expressionJa: 'このOBJECTを試してみたい？',
  },
  {
    expression: 'Do you want to eat this OBJECT?',
    expressionJa: 'このOBJECTを食べたい？',
  },
  {
    expression: 'Do you want to drink this OBJECT?',
    expressionJa: 'このOBJECTを飲みたい？',
  },
  {
    expression: 'Do you want to read this OBJECT?',
    expressionJa: 'このOBJECTを読みたい？',
  },
  {
    expression: 'Do you want to watch this OBJECT?',
    expressionJa: 'このOBJECTを見たい？',
  },
  {
    expression: 'Do you want to buy this OBJECT?',
    expressionJa: 'このOBJECTを買いたい？',
  },
  {
    expression: 'Do you want to play with this OBJECT?',
    expressionJa: 'このOBJECTで遊びたい？',
  },
  {
    expression: 'Did you bring your OBJECT?',
    expressionJa: 'あなたのOBJECTを持ってきた？',
  },
  {
    expression: 'Did you forget your OBJECT?',
    expressionJa: 'あなたのOBJECTを忘れた？',
  },
  {
    expression: 'Did you lose your OBJECT?',
    expressionJa: 'あなたのOBJECTをなくした？',
  },
  {
    expression: 'Is this your OBJECT?',
    expressionJa: 'これはあなたのOBJECT？',
  },
  {
    expression: 'Is that your OBJECT?',
    expressionJa: 'あれはあなたのOBJECT？',
  },
  {
    expression: 'Is this OBJECT yours?',
    expressionJa: 'このOBJECTはあなたのもの？',
  },
  {
    expression: 'Is this OBJECT new?',
    expressionJa: 'このOBJECTは新しい？',
  },
  {
    expression: 'Is this OBJECT expensive?',
    expressionJa: 'このOBJECTは高い？',
  },
  {
    expression: 'Is this OBJECT cheap?',
    expressionJa: 'このOBJECTは安い？',
  },
  {
    expression: 'Is this OBJECT too big?',
    expressionJa: 'このOBJECTは大きすぎる？',
  },
  {
    expression: 'Is this OBJECT too small?',
    expressionJa: 'このOBJECTは小さすぎる？',
  },
  {
    expression: 'Is this OBJECT for class?',
    expressionJa: 'このOBJECTは授業で使うもの？',
  },
  {
    expression: 'Is this OBJECT for me?',
    expressionJa: 'このOBJECTは私のためのもの？',
  },
  {
    expression: 'Where is my OBJECT?',
    expressionJa: '私のOBJECTはどこ？',
  },
  {
    expression: 'Where is your OBJECT?',
    expressionJa: 'あなたのOBJECTはどこ？',
  },
  {
    expression: 'Where is the OBJECT?',
    expressionJa: 'そのOBJECTはどこ？',
  },
  {
    expression: 'Where can I buy this OBJECT?',
    expressionJa: 'このOBJECTはどこで買える？',
  },
  {
    expression: 'Where can I find the OBJECT?',
    expressionJa: 'そのOBJECTはどこで見つかる？',
  },
  {
    expression: 'Where should I put this OBJECT?',
    expressionJa: 'このOBJECTをどこに置けばいい？',
  },
  {
    expression: 'What is this OBJECT?',
    expressionJa: 'このOBJECTは何？',
  },
  {
    expression: 'What does this OBJECT mean?',
    expressionJa: 'このOBJECTはどういう意味？',
  },
  {
    expression: 'What do you think of this OBJECT?',
    expressionJa: 'このOBJECTをどう思う？',
  },
  {
    expression: 'What kind of OBJECT do you like?',
    expressionJa: 'どんなOBJECTが好き？',
  },
  {
    expression: 'What is your favorite OBJECT?',
    expressionJa: '好きなOBJECTは何？',
  },
  {
    expression: 'Which OBJECT do you like?',
    expressionJa: 'どのOBJECTが好き？',
  },
  {
    expression: 'Which OBJECT is yours?',
    expressionJa: 'どのOBJECTがあなたのもの？',
  },
  {
    expression: 'Which OBJECT should I choose?',
    expressionJa: 'どのOBJECTを選べばいい？',
  },
  {
    expression: 'How much is this OBJECT?',
    expressionJa: 'このOBJECTはいくら？',
  },
  {
    expression: 'How about this OBJECT?',
    expressionJa: 'このOBJECTはどう？',
  },
  {
    expression: 'How was the OBJECT?',
    expressionJa: 'そのOBJECTはどうだった？',
  },
  {
    expression: 'I want this OBJECT, please.',
    expressionJa: 'このOBJECTをください。',
  },
  {
    expression: "I'll take this OBJECT.",
    expressionJa: 'このOBJECTにします。',
  },
  {
    expression: "I'll have this OBJECT.",
    expressionJa: 'このOBJECTにします。',
  },
  {
    expression: 'Could I get this OBJECT?',
    expressionJa: 'このOBJECTをもらえますか？',
  },
  {
    expression: 'Please give me the OBJECT.',
    expressionJa: 'そのOBJECTをください。',
  },
  {
    expression: 'Please show me the OBJECT.',
    expressionJa: 'そのOBJECTを見せてください。',
  },
  {
    expression: 'Please bring your OBJECT.',
    expressionJa: 'あなたのOBJECTを持ってきてください。',
  },
  {
    expression: 'I want to try this OBJECT.',
    expressionJa: 'このOBJECTを試してみたい。',
  },
  {
    expression: 'I want to eat this OBJECT.',
    expressionJa: 'このOBJECTを食べたい。',
  },
  {
    expression: 'I want to drink this OBJECT.',
    expressionJa: 'このOBJECTを飲みたい。',
  },
  {
    expression: 'I want to read this OBJECT.',
    expressionJa: 'このOBJECTを読みたい。',
  },
  {
    expression: 'I want to watch this OBJECT.',
    expressionJa: 'このOBJECTを見たい。',
  },
  {
    expression: 'I want to buy this OBJECT.',
    expressionJa: 'このOBJECTを買いたい。',
  },
  {
    expression: 'I want to play with this OBJECT.',
    expressionJa: 'このOBJECTで遊びたい。',
  },
  {
    expression: 'I need my OBJECT.',
    expressionJa: '私のOBJECTが必要です。',
  },
  {
    expression: 'I forgot my OBJECT.',
    expressionJa: '私のOBJECTを忘れました。',
  },
  {
    expression: 'I lost my OBJECT.',
    expressionJa: '私のOBJECTをなくしました。',
  },
  {
    expression: 'I found your OBJECT.',
    expressionJa: 'あなたのOBJECTを見つけました。',
  },
  {
    expression: 'I dropped my OBJECT.',
    expressionJa: '私のOBJECTを落としました。',
  },
  {
    expression: 'I broke your OBJECT.',
    expressionJa: 'あなたのOBJECTを壊してしまいました。',
  },
  {
    expression: "I'm looking for my OBJECT.",
    expressionJa: '私のOBJECTを探しています。',
  },
  {
    expression: 'I have a question about this OBJECT.',
    expressionJa: 'このOBJECTについて質問があります。',
  },
  {
    expression: 'I think this OBJECT is good.',
    expressionJa: 'このOBJECTはいいと思う。',
  },
  {
    expression: 'I think this OBJECT is fun.',
    expressionJa: 'このOBJECTは楽しいと思う。',
  },
  {
    expression: 'I think this OBJECT is hard.',
    expressionJa: 'このOBJECTは難しいと思う。',
  },
  {
    expression: 'I like this OBJECT better.',
    expressionJa: 'このOBJECTのほうが好き。',
  },
  {
    expression: "I don't like this OBJECT very much.",
    expressionJa: 'このOBJECTはあまり好きじゃない。',
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
