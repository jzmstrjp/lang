'use client';

import { useState } from 'react';

type SceneFields = {
  senderName: string;
  receiverName: string;
  senderRole: string;
  receiverRole: string;
  senderVoice: 'male' | 'female';
  receiverVoice: 'male' | 'female';
  englishSentence: string;
  japaneseSentence: string;
  englishReply: string;
  japaneseReply: string;
  place: string;
  receiverPlace: string;
  how: string;
  senderWhen: string;
  senderWhy: string;
  senderWant: string;
};

export type DefaultScene = SceneFields;

type TranslateResult = {
  japanese: string;
};

const DEFAULT_SCENE: SceneFields = {
  senderName: '',
  receiverName: '',
  senderRole: '',
  receiverRole: '',
  senderVoice: 'male',
  receiverVoice: 'female',
  englishSentence: '',
  japaneseSentence: '',
  englishReply: '',
  japaneseReply: '',
  place: '',
  receiverPlace: '',
  how: '',
  senderWhen: '',
  senderWhy: '',
  senderWant: '',
};

export default function TranslateTestClient({ defaultScene }: { defaultScene?: DefaultScene }) {
  const scene = defaultScene ?? DEFAULT_SCENE;
  const [translate, setTranslate] = useState<'sender' | 'receiver'>('sender');
  const [additionalInstruction, setAdditionalInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResult | null>(null);

  const targetEnglish = translate === 'sender' ? scene.englishSentence : scene.englishReply;

  const doTranslate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/prompt-test/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scene,
          translate,
          additionalInstruction: additionalInstruction.trim(),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to translate');
      }

      const data = (await response.json()) as TranslateResult;
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
        <h1 className="text-3xl font-bold text-center mb-2 text-[var(--text)]">翻訳テスト</h1>
        <p className="text-center text-[var(--text-muted)] mb-8 text-base">
          翻訳プロンプトの効果を確認できます。
        </p>

        <div className="bg-[var(--card)] rounded-2xl shadow-md p-6 space-y-5">
          {/* 会話 */}
          <div className="space-y-2">
            {/* 送り手 */}
            <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-3 space-y-1">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {scene.senderName}（{scene.senderRole}・
                {scene.senderVoice === 'male' ? '男性' : '女性'}）@ {scene.place}
              </p>
              <p className="text-lg font-bold text-[var(--text)]">{scene.japaneseSentence}</p>
              {translate === 'sender' && result && !loading && (
                <p className="text-lg font-bold text-[var(--primary)]">→ {result.japanese}</p>
              )}
              <p className="text-sm text-[var(--text-muted)]">{scene.englishSentence}</p>
            </div>

            {/* 受け手 */}
            <div className="rounded-xl bg-[var(--border)]/20 border border-[var(--border)] p-3 space-y-1">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {scene.receiverName}（{scene.receiverRole}・
                {scene.receiverVoice === 'male' ? '男性' : '女性'}）@ {scene.receiverPlace}
              </p>
              <p className="text-lg font-bold text-[var(--text)]">{scene.japaneseReply}</p>
              {translate === 'receiver' && result && !loading && (
                <p className="text-lg font-bold text-[var(--primary)]">→ {result.japanese}</p>
              )}
              <p className="text-sm text-[var(--text-muted)]">{scene.englishReply}</p>
            </div>
          </div>

          {/* シーン情報 */}
          <div className="text-sm text-[var(--text-muted)] space-y-1 border-t border-[var(--border)] pt-4">
            <p>
              <span className="font-semibold">会話の手段:</span> {scene.how}
            </p>
            <p>
              <span className="font-semibold">タイミング:</span> {scene.senderWhen}
            </p>
            <p>
              <span className="font-semibold">きっかけ:</span> {scene.senderWhy}
            </p>
            <p>
              <span className="font-semibold">期待:</span> {scene.senderWant}
            </p>
          </div>

          {/* 翻訳対象 + 追加指示 + ボタン */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="field-translate"
                className="block text-base font-semibold text-[var(--text)] mb-2"
              >
                翻訳対象
              </label>
              <select
                id="field-translate"
                value={translate}
                onChange={(e) => {
                  setTranslate(e.target.value as 'sender' | 'receiver');
                  setResult(null);
                }}
                className="px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="sender">送り手（1コマ目）</option>
                <option value="receiver">受け手（2コマ目）</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
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
                className="w-full px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            <button
              onClick={() => void doTranslate()}
              disabled={loading || !targetEnglish.trim()}
              className="px-8 py-3 text-base font-semibold bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '翻訳中...' : '翻訳'}
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
      </div>
    </div>
  );
}
