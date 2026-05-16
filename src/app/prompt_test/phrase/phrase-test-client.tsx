'use client';

import { useState } from 'react';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import type { GenerateForPhraseResult } from '@/lib/phrase-generator';

type PhraseTestResult = {
  results: GenerateForPhraseResult[];
};

export default function PhraseTestClient({ defaultPhrase = '' }: { defaultPhrase?: string }) {
  const [phrase, setPhrase] = useState(defaultPhrase);
  const [additionalInstruction, setAdditionalInstruction] = useState('');
  const [selectedType, setSelectedType] = useState<ProblemLength>('short');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhraseTestResult | null>(null);

  const generate = async () => {
    if (!phrase.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/problem/generate-from-phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: phrase.trim(),
          additionalInstruction: additionalInstruction.trim(),
          type: selectedType,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to generate');
      }

      const data = (await response.json()) as PhraseTestResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-10">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-2 text-[var(--text)]">
          フレーズ指示テスト
        </h1>
        <p className="text-center text-[var(--text-muted)] mb-8 text-base">
          フレーズと追加指示を入力して、プロンプトの効果を確認できます。
        </p>

        <div className="bg-[var(--card)] rounded-2xl shadow-md p-6 space-y-5">
          {/* フレーズ */}
          <div>
            <label
              htmlFor="phrase-input"
              className="block text-base font-semibold text-[var(--text)] mb-2"
            >
              フレーズ
            </label>
            <input
              id="phrase-input"
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder=""
              className="w-full px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* 追加指示 */}
          <div>
            <label
              htmlFor="additional-instruction"
              className="block text-base font-semibold text-[var(--text)] mb-2"
            >
              追加指示
            </label>
            <input
              id="additional-instruction"
              type="text"
              value={additionalInstruction}
              onChange={(e) => setAdditionalInstruction(e.target.value)}
              placeholder=""
              className="w-full px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* 問題の長さ + 生成ボタン */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="phrase-test-type"
                className="block text-base font-semibold text-[var(--text)] mb-2"
              >
                問題の長さ
              </label>
              <select
                id="phrase-test-type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as ProblemLength)}
                className="px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                {(Object.keys(WORD_COUNT_RULES) as ProblemLength[]).map((key) => {
                  const rule = WORD_COUNT_RULES[key];
                  return (
                    <option key={key} value={key}>
                      {key} ({rule.min}–{rule.max}語)
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => void generate()}
              disabled={loading || !phrase.trim()}
              className="px-8 py-3 text-base font-semibold bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '生成中...' : '生成'}
            </button>
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500 rounded-xl p-4">
            <p className="text-red-400 text-base">エラー: {error}</p>
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="mt-8 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]" />
          </div>
        )}

        {/* 結果 */}
        {result && !loading && (
          <div className="mt-8 space-y-4">
            {result.results.map((item, i) => (
              <div
                key={i}
                className="bg-[var(--card)] rounded-2xl overflow-hidden border border-[var(--border)]"
              >
                <div className="px-5 py-2 bg-[var(--border)]/30 font-semibold text-[var(--text-muted)] tracking-wider">
                  #{i + 1} {item.how}・{item.where} → {item.receiverWhere}
                </div>
                <div className="px-5 py-4 space-y-3">
                  {/* 会話 */}
                  <div className="space-y-2">
                    <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-3 space-y-1">
                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {item.senderName}（{item.senderRole}・
                        {item.voice === 'male' ? '男性' : '女性'}）
                      </p>
                      <p className="text-lg font-bold text-[var(--text)]">
                        {item.japaneseSentence}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">{item.englishSentence}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--border)]/20 border border-[var(--border)] p-3 space-y-1">
                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {item.receiverName}（{item.receiverRole}・
                        {item.voice === 'male' ? '男性' : '女性'}）
                      </p>
                      <p className="text-lg font-bold text-[var(--text)]">{item.japaneseReply}</p>
                      <p className="text-sm text-[var(--text-muted)]">{item.englishReply}</p>
                    </div>
                  </div>

                  {/* シーン情報 */}
                  <div className="text-sm text-[var(--text-muted)] space-y-1 border-t border-[var(--border)] pt-3">
                    <p>
                      <span className="font-semibold">タイミング:</span> {item.when}
                    </p>
                    <p>
                      <span className="font-semibold">きっかけ:</span> {item.why}
                    </p>
                    <p>
                      <span className="font-semibold">期待:</span> {item.want}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
