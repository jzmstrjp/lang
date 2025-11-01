'use client';

import { useState } from 'react';
import { SceneImage } from '@/components/ui/scene-image';
import type { GeneratedProblem } from '@/types/generated-problem';

const CORRECT_INDEX = 0;
const DEFAULT_TYPE = 'short';

type AssetsData = {
  audio: {
    english: string;
    japanese: string;
    englishReply?: string;
  };
  imagePrompt?: string;
  composite?: string | null;
};

type GenerateProblemResponse = {
  problem: GeneratedProblem;
  options: string[];
  assets: AssetsData;
};

type GenerateMode = 'withImage' | 'withoutImage';

export default function PromptTestClient() {
  const [problem, setProblem] = useState<GeneratedProblem | null>(null);
  const [assets, setAssets] = useState<AssetsData | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateProblem = async (type: 'short' | 'medium' | 'long', mode: GenerateMode) => {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch('/api/problem/test-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, withoutPicture: mode === 'withoutImage' }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate problem');
      }

      const data = (await response.json()) as GenerateProblemResponse;
      setProblem(data.problem);
      setAssets(data.assets);
      setOptions(data.options);

      if (data.assets?.audio) {
        setTimeout(() => {
          void playAudioSequenceWithAssets(data.assets);
        }, 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('クリップボードへのコピーに失敗しました');
    }
  };

  const playAudioSequenceWithAssets = async (audioAssets: AssetsData) => {
    if (!audioAssets?.audio || isPlaying) return;

    setIsPlaying(true);

    try {
      const englishAudio = new Audio(audioAssets.audio.english);
      await new Promise<void>((resolve, reject) => {
        englishAudio.onended = () => resolve();
        englishAudio.onerror = () => reject(new Error('English audio failed'));
        englishAudio.play();
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const japaneseAudio = new Audio(audioAssets.audio.japanese);
      await new Promise<void>((resolve, reject) => {
        japaneseAudio.onended = () => resolve();
        japaneseAudio.onerror = () => reject(new Error('Japanese audio failed'));
        japaneseAudio.play();
      });
    } catch (err) {
      console.error('Audio playback error:', err);
      setError('音声の再生に失敗しました');
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-4 text-[var(--text)]">プロンプトテスト</h1>
        <p className="text-center text-[var(--text-muted)] mb-8">
          問題生成後、自動で音声が再生されます（英語→日本語の順）
        </p>

        <div className="bg-[var(--background)] rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            <button
              onClick={() => generateProblem(DEFAULT_TYPE, 'withoutImage')}
              disabled={loading}
              className="px-6 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              画像なしで生成
            </button>
            <button
              onClick={() => generateProblem(DEFAULT_TYPE, 'withImage')}
              disabled={loading}
              className="px-6 py-2 bg-[var(--secondary)] text-[var(--secondary-text)] rounded-lg hover:bg-[var(--secondary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              画像ありで生成
            </button>
          </div>

          {loading && (
            <div className="space-y-4" aria-live="polite">
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                <p className="text-[var(--text-muted)]">生成中...</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-24 bg-[var(--border)] animate-pulse rounded-md" />
                <div className="h-24 bg-[var(--border)] animate-pulse rounded-md" />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[var(--error)]/10 border border-[var(--error)] rounded-lg p-4 mb-4">
              <p className="text-[var(--error-dark)]">エラー: {error}</p>
            </div>
          )}

          {problem && !loading && (
            <div className="space-y-6">
              {assets?.audio && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={() => playAudioSequenceWithAssets(assets)}
                    disabled={isPlaying}
                    className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {isPlaying ? '再生中...' : '🔊 音声をもう一度再生'}
                  </button>
                </div>
              )}

              {assets?.composite && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-purple-800 mb-2">生成された画像</h3>
                  <div className="flex justify-center">
                    <SceneImage
                      src={assets.composite}
                      alt="Generated scene illustration"
                      opacity="full"
                      className="rounded-lg shadow-md"
                    />
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">英文</h3>
                <p className="text-xl text-blue-900 font-medium">{problem.englishSentence}</p>
                <p className="mt-2 text-sm text-blue-500">{problem.senderVoiceInstruction}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-2">日本語返答</h3>
                <p className="text-xl text-green-900 font-medium">{problem.japaneseReply}</p>
                <p className="mt-2 text-sm text-green-500">{problem.receiverVoiceInstruction}</p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-orange-800 mb-4">選択肢</h3>
                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-2 ${
                        index === CORRECT_INDEX
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-sm px-2 py-1 rounded ${
                            index === CORRECT_INDEX
                              ? 'bg-green-200 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                        {index === CORRECT_INDEX && (
                          <span className="text-green-600 font-semibold text-sm">✓ 正解</span>
                        )}
                        <span className="text-base">{option}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-purple-50 border border-purple-200 rounded p-3">
                  <span className="font-semibold text-purple-800">シーン:</span>
                  <p className="text-purple-700">{problem.place}</p>
                </div>
                {(problem.senderRole || problem.receiverRole) && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded p-3">
                    <span className="font-semibold text-cyan-800">キャラクター:</span>
                    <p className="text-cyan-700">
                      {problem.senderRole} → {problem.receiverRole}
                    </p>
                  </div>
                )}
              </div>

              {assets?.imagePrompt && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-amber-800">画像生成プロンプト</h3>
                    <button
                      onClick={() => copyToClipboard(assets.imagePrompt || '')}
                      className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors"
                      title="クリップボードにコピー"
                    >
                      {copied ? (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>コピーしました!</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          <span>コピー</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-sm text-amber-700 leading-relaxed whitespace-pre-line bg-white border border-amber-200 rounded p-3">
                    {assets.imagePrompt}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
