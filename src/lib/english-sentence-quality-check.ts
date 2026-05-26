import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { TEXT_MODEL_QUICK } from '@/const';
import type { ProblemLength } from '@/config/problem';
import { recordTokenUsage } from '@/lib/token-usage-tracker';
import { How } from './english-sentence-prompt';

export type QualityCheckResult =
  | { isOk: true }
  | { isOk: false; reason: string; correctSentenceDraft: string | null };

function buildQualityCheckPrompt(
  englishSentence: string,
  expression: string,
  motivation: string,
  senderRole: string,
  receiverRole: string,
  how: How,
): string {
  const idiomCheck = expression.includes(' ')
    ? '- 指定されたフレーズが慣用句の場合は、文字通りの意味で使わず慣用句として適切に使われているか\n'
    : '';
  return `あなたは英語ネイティブスピーカーの視点で、英語学習アプリ用の口語文の品質を審査する専門家です。

以下の観点で審査してください：
- ネイティブが実際に口語会話で使う自然な表現か
- 文法的に正確か
${idiomCheck}
- フレーズが不自然に無理やり当てはめられていないか
- 動機・登場人物・英文の内容が、総合的な場面として矛盾していないか

---
【指定フレーズ】${expression}
【判定対象の英文】${englishSentence}
【話しかけた人の立場】${senderRole}
【話しかけられた人の立場】${receiverRole}
【会話の方法】${how}
【発言の動機】${motivation}
---

以下のJSON形式で必ず回答してください。reason は日本語で50文字以内。

合格の場合：
\`\`\`json
{ "isOk": true }
\`\`\`

不合格の場合：
\`\`\`json
{ "isOk": false, "reason": "ダメな理由（50文字以内）", "correctSentenceDraft": "この英文なら良かった、という代替案（英文のみ）。代替案がなければnull" }
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
    motivation,
    senderRole,
    receiverRole,
    how,
  }: {
    expression: string;
    wordCountLength: ProblemLength;
    prompt: string;
    englishSentence: string;
    motivation: string;
    senderRole: string;
    receiverRole: string;
    how: How;
  },
): Promise<QualityCheckResult> {
  const checkPrompt = buildQualityCheckPrompt(
    englishSentence,
    expression,
    motivation,
    senderRole,
    receiverRole,
    how,
  );

  const response = await openai.responses.create({
    model: TEXT_MODEL_QUICK,
    input: [{ role: 'user', content: checkPrompt }],
    temperature: 0.1,
    prompt_cache_retention: '24h',
    prompt_cache_key: 'quality-check-v1',
  });
  recordTokenUsage('品質チェック', response.usage);

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
