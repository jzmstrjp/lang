'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

type ReplyResult = {
  englishReply: string;
  japaneseReply: string;
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

export default function ReplyTestClient({ defaultScene }: { defaultScene?: DefaultScene }) {
  const router = useRouter();
  const scene = defaultScene ?? DEFAULT_SCENE;
  const [additionalInstruction, setAdditionalInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReplyResult | null>(null);
  const [senderVisible, setSenderVisible] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/prompt-test/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scene, additionalInstruction: additionalInstruction.trim() }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to generate');
      }

      const data = (await response.json()) as ReplyResult;
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
        <h1 className="text-3xl font-bold text-center mb-2 text-[var(--text)]">返答生成テスト</h1>
        <p className="text-center text-[var(--text-muted)] text-base">
          返答の生成プロンプトを試せます。
        </p>

        <div className="bg-[var(--card)] rounded-2xl shadow-md p-6 space-y-5">
          {/* 問題変更 */}
          <div className="flex justify-center">
            <button
              onClick={() => {
                setResult(null);
                setSenderVisible(false);
                router.refresh();
              }}
              className="px-5 py-2 text-sm font-semibold border-2 border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              問題変更
            </button>
          </div>

          {/* 会話 */}
          <div className="space-y-2">
            {/* 送り手 */}
            <button
              type="button"
              onClick={() => setSenderVisible(true)}
              className="w-full text-left rounded-xl bg-[var(--background)] border border-[var(--border)] p-3 space-y-1 cursor-pointer hover:border-[var(--primary)]/50 transition-colors"
            >
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {scene.senderName}（{scene.senderRole}・
                {scene.senderVoice === 'male' ? '男性' : '女性'}）@ {scene.place}
              </p>
              {senderVisible ? (
                <>
                  <p className="text-lg font-bold text-[var(--text)]">{scene.japaneseSentence}</p>
                  <p className="text-sm text-[var(--text-muted)]">{scene.englishSentence}</p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)] select-none">タップして表示</p>
              )}
            </button>

            {/* 受け手：既存 */}
            <div className="rounded-xl bg-[var(--border)]/20 border border-[var(--border)] p-3 space-y-1">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {scene.receiverName}（{scene.receiverRole}・
                {scene.receiverVoice === 'male' ? '男性' : '女性'}）@ {scene.receiverPlace}
              </p>
              <p className="text-lg font-bold text-[var(--text)]">{scene.japaneseReply}</p>
              <p className="text-sm text-[var(--text-muted)]">{scene.englishReply}</p>
              {/* 受け手：生成された返答 */}
              {result && !loading && (
                <>
                  <p className="ml-4">↓↓↓↓↓↓↓</p>
                  <p className="text-lg font-bold text-[var(--text)]">{result.japaneseReply}</p>
                  <p className="text-sm text-[var(--text-muted)]">{result.englishReply}</p>
                </>
              )}
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
              className="w-full px-4 py-3 text-base border-2 border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <button
            onClick={() => void generate()}
            disabled={loading || !scene.englishSentence.trim()}
            className="w-full px-8 py-3 text-base font-semibold bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '生成中...' : '返答を生成'}
          </button>
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
