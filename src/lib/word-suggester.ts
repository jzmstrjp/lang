import { OpenAI } from 'openai';
import { TEXT_MODEL_RICH_SCENE } from '@/const';
import { recordTokenUsage } from '@/lib/token-usage-tracker';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function suggestWordsForCategory(
  isKids: boolean,
  existingExpressions: string[],
  existingWords: { expression: string; expressionJa: string; isKids: boolean }[],
  sampleSentences: string[],
): Promise<{ expression: string; expressionJa: string }[]> {
  const categoryLabel = isKids ? 'kids（子ども向け）' : 'non-kids（大人向け）';

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

  const prompt = `あなたは英語学習アプリの語彙設計者です。
対象カテゴリ: **${categoryLabel}**

以下の情報をもとに、このカテゴリに追加すべき expression 候補を提案してください。

## すでに使用済みの expression（重複不可）
${usedListText}

## 既存問題の英文サンプル（語彙レベル・傾向の参考）
${sampleSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 提案ルール
- 使用済み expression と重複しないこと（今回の提案リスト内でも重複不可）
  - ただし同じ単語でも意味（expressionJa）が異なれば別の expression として提案してよい（例: "play（遊ぶ）" と "play（からかう）" は別物）
- 単語・イディオム単体で会話の軸になれるもの（例: "apologize", "give it a shot"）
- イディオムは5語以内に収めること
- **ネイティブが日常の口語会話で実際に使う表現に限定すること**
  - フォーマル語・書き言葉は避けること（例: accompany→come with, inquire→ask, consult→talk to, assist→help, commence→start）
${
  isKids
    ? `- 小中学生レベルの平易な語彙（例: "share", "help out", "excited"）
- 子どもの日常生活・学校・家族に関連するものが望ましい
- 副詞は日常会話で自然に使えるものに限定（例: really, carefully, together, slowly, quietly, quickly, nicely）
  - 避けるべき副詞の例: gratefully（フォーマル・スピーチ調）
- 感謝・気持ち系の形容詞はカジュアルなものに限定（thankful は可。grateful / heartfelt などフォーマル・硬い語は避ける）
- 感謝表現はカジュアルなものに限定（appreciate は可。gratefully / receive / understanding などフォーマル語は避ける）`
    : `- TOEIC や社会人の日常英会話で頻出の語彙・表現を優先
- ビジネス・旅行・日常生活など幅広いシーンに対応`
}
- 全体の約1/3は「comfort word」にすること。comfort word とは、温かみ・安心感・やさしさを連想させる語彙・表現。
${
  isKids
    ? `  - kids向け comfort word の例: "hug", "cozy", "snuggle", "gentle", "kind", "warm", "cheerful", "thankful", "smile", "together"`
    : `  - non-kids向け comfort word の例: "cozy", "warmth", "heartfelt", "grateful", "cherish", "soothe", "serene", "comfort", "healing", "empathy"`
}
- 目標数: 名詞 20個・動詞 20個・形容詞 20個・副詞 20個・イディオム 10個（合計 90個程度）

## 出力形式（JSON）
"words" キーに { "expression": string, "expressionJa": string } のオブジェクト配列を返してください（説明などは不要）。
- expression: 英語の単語・表現
- expressionJa: 日本語の意味（1つだけ。「献身的な、専念した」のように複数書かない）

例:
{
  "words": [
    { "expression": "apologize", "expressionJa": "謝罪する" },
    { "expression": "give it a shot", "expressionJa": "試してみる" },
    { "expression": "deadline", "expressionJa": "締め切り" },
    { "expression": "come up with", "expressionJa": "思いつく" },
    { "expression": "no wonder", "expressionJa": "〜なのは当然だ" },
    { "expression": "count on", "expressionJa": "頼りにする" },
    { "expression": "run into", "expressionJa": "偶然会う" }
  ]
}`;

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
