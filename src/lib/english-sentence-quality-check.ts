import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { TEXT_MODEL_QUICK } from '@/const';
import type { ProblemLength } from '@/config/problem';

export type QualityCheckResult =
  | { isOk: true }
  | { isOk: false; reason: string; correctSentenceDraft: string | null };

function buildQualityCheckPrompt(prompt: string, englishSentence: string): string {
  return `
あなたは英語ネイティブスピーカーの視点で、英語学習アプリ用の口語文の品質を審査する専門家です。

以下の【生成プロセス】に従って英文が生成されました。
生成された英文がネイティブの自然な口語として高品質かどうかを判定してください。

---
【判定対象の英文】
${englishSentence}
---
【生成プロセス（プロンプト全文）】
${prompt}
---

以下の観点で審査してください：
- ネイティブが実際に口語会話で使う自然な表現か
- 文法的に正確か
- 指定されたフレーズが慣用句・口語表現として適切に使われているか
- 語数制約・kids/adult 設定と内容が釣り合っているか
- 指定プロンプト全体の条件に対して誠実に応えられているか（フレーズが無理やり当てはめられていないか）

以下のJSON形式で必ず回答してください。reason は日本語で50文字以内。

合格の場合：
\`\`\`json
{ "isOk": true }
\`\`\`

不合格の場合：
\`\`\`json
{ "isOk": false, "reason": "ダメな理由（50文字以内）最後に「指定されたフレーズが原因」などと本質的な原因で締めること", "correctSentenceDraft": "この英文なら良かった、という代替案（英文のみ）。代替案がなければnull" }
\`\`\`
`;
}

export async function checkEnglishSentenceQuality(
  openai: OpenAI,
  {
    expression,
    wordCountLength,
    prompt,
    englishSentence,
  }: {
    expression: string;
    wordCountLength: ProblemLength;
    prompt: string;
    englishSentence: string;
  },
): Promise<QualityCheckResult> {
  const checkPrompt = buildQualityCheckPrompt(prompt, englishSentence);

  const response = await openai.responses.create({
    model: TEXT_MODEL_QUICK,
    input: [{ role: 'user', content: checkPrompt }],
    temperature: 0.1,
  });

  const content = response.output_text?.trim();
  if (!content) throw new Error('品質チェックレスポンスが空です');

  const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
  if (!jsonMatch?.[1]) throw new Error('品質チェックのJSONが見つかりませんでした');

  const parsed = JSON.parse(jsonMatch[1]) as {
    isOk: boolean;
    reason: string;
    correctSentenceDraft?: string | null;
  };

  const result: QualityCheckResult = parsed.isOk
    ? { isOk: true }
    : {
        isOk: false,
        reason: parsed.reason,
        correctSentenceDraft: parsed.correctSentenceDraft ?? null,
      };

  if (!result.isOk) {
    await prisma.englishSentenceQualityLog.create({
      data: {
        expression,
        wordCountLength,
        prompt,
        englishSentence,
        isOk: false,
        reason: result.reason,
        correctSentenceDraft: result.correctSentenceDraft,
      },
    });
  }

  return result;
}
