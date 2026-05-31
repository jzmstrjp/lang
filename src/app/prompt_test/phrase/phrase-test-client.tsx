'use client';

import { useCallback, useEffect, useState } from 'react';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import type { GenerateForPhraseResult } from '@/lib/phrase-generator';

type PhraseTestResult = {
  results: GenerateForPhraseResult[];
};

type RandomPhraseResponse = {
  expression: string;
  expressionJa: string;
};

export default function PhraseTestClient() {
  const [phrase, setPhrase] = useState('');
  const [phraseJa, setPhraseJa] = useState('');
  const [additionalInstruction, setAdditionalInstruction] = useState('');
  const [selectedType, setSelectedType] = useState<ProblemLength>('short');
  const [phraseLoading, setPhraseLoading] = useState(true);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhraseTestResult | null>(null);

  const fetchRandomPhrase = useCallback(async (type: ProblemLength) => {
    setPhraseLoading(true);
    setPhraseError(null);

    try {
      const response = await fetch(
        `/api/prompt-test/random-phrase?type=${encodeURIComponent(type)}`,
      );
      const data = (await response.json()) as RandomPhraseResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'フレーズの取得に失敗しました');
      }

      setPhrase(data.expression);
      setPhraseJa(data.expressionJa);
    } catch (err) {
      setPhrase('');
      setPhraseJa('');
      setPhraseError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPhraseLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRandomPhrase(selectedType);
  }, [selectedType, fetchRandomPhrase]);

  const handleTypeChange = (type: ProblemLength) => {
    setSelectedType(type);
    setResult(null);
    setError(null);
  };

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

  const isBusy = phraseLoading || loading;

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
          {/* 問題の長さ */}
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
              onChange={(e) => handleTypeChange(e.target.value as ProblemLength)}
              disabled={isBusy}
              className="px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
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

          {/* フレーズ */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label htmlFor="phrase-input" className="text-base font-semibold text-[var(--text)]">
                フレーズ
              </label>
              <button
                type="button"
                onClick={() => void fetchRandomPhrase(selectedType)}
                disabled={isBusy}
                className="px-4 py-2 text-sm font-semibold border-2 border-[var(--border)] rounded-xl text-[var(--text)] hover:bg-[var(--border)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {phraseLoading ? '取得中...' : 'フレーズをランダム変更'}
              </button>
            </div>

            <div className="relative">
              {phraseLoading ? (
                <div
                  className="flex items-center justify-center gap-3 w-full min-h-[52px] px-4 py-3 border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text-muted)]"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--primary)] border-t-transparent" />
                  <span className="text-base">フレーズを取得中...</span>
                </div>
              ) : (
                <>
                  <input
                    id="phrase-input"
                    type="text"
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    placeholder="フレーズがありません"
                    disabled={loading}
                    className="w-full px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
                  />
                  {phraseJa && <p className="mt-2 text-sm text-[var(--text-muted)]">{phraseJa}</p>}
                </>
              )}
            </div>

            {phraseError && !phraseLoading && (
              <p className="mt-2 text-sm text-red-400">{phraseError}</p>
            )}
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
              disabled={isBusy}
              className="w-full px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
            />
          </div>

          <button
            onClick={() => void generate()}
            disabled={isBusy || !phrase.trim()}
            className="w-full sm:w-auto px-8 py-3 text-base font-semibold bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '生成中...' : '生成'}
          </button>
        </div>

        {/* エラー */}
        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500 rounded-xl p-4">
            <p className="text-red-400 text-base">エラー: {error}</p>
          </div>
        )}

        {/* 生成ローディング */}
        {loading && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]" />
            <p className="text-base text-[var(--text-muted)]">問題を生成中...</p>
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
                      {item.senderDoing && (
                        <p className="text-sm text-[var(--text-muted)]">（{item.senderDoing}）</p>
                      )}
                      <p className="text-sm text-[var(--text-muted)]">{item.englishSentence}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--border)]/20 border border-[var(--border)] p-3 space-y-1">
                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {item.receiverName}（{item.receiverRole}・
                        {item.voice === 'male' ? '女性' : '男性'}）
                      </p>
                      <p className="text-lg font-bold text-[var(--text)]">{item.japaneseReply}</p>
                      {item.receiverDoing && (
                        <p className="text-sm text-[var(--text-muted)]">（{item.receiverDoing}）</p>
                      )}
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
                    <p>
                      <span className="font-semibold">返答の概要:</span> {item.englishReplyDraft}
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
