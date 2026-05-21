import { OpenAI } from 'openai';
import { TEXT_MODEL_RICH_SCENE } from '@/const';
import { recordTokenUsage } from '@/lib/token-usage-tracker';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
以下を参考に、足りていないものを生成してください。

${sampleSentencesText}
`;

const kidsRules = `## 提案ルール
- 中学一年生でも知っているレベルの語彙で作成してください。
- イディオムは3単語までのものを作成してください。
- 短文の中で使う前提です。「however」など、文と文を繋ぐような（長文を連想させる）接続詞は避けてください。
`;

const nonKidsRules = `## 提案ルール
- 日常生活系・ビジネス系の語彙を半分ずつくらい生成してください。
- TOEICのListening（口語）によく出るものを優先して生成してください。
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

export async function suggestWordsForCategory(
  isKids: boolean,
  existingExpressions: string[],
  existingWords: { expression: string; expressionJa: string; isKids: boolean }[],
  sampleSentences: string[],
): Promise<{ expression: string; expressionJa: string }[]> {
  const usedFromWords = existingWords
    .filter((w) => w.isKids === isKids)
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

  const rules = isKids ? kidsRules : nonKidsRules;

  const prompt = `${commonPromptPrefix(usedListText, sampleSentencesText)}\n${rules}\n${commonPromptSuffix}`;

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
  return (parsed.words ?? []).filter((w) => w.expression && w.expressionJa);
}
