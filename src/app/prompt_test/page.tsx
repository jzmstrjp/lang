'use client';

import { useState } from 'react';
import Image from 'next/image';

const WITHOUT_PICTURE = true;

type GeneratedProblem = {
  english: string;
  japaneseReply: string;
  scenePrompt: string;
  type: string;
  sceneId: string;
  options: string[];
  correctIndex: number;
  characterRoles?: {
    character1: string;
    character2: string;
  };
};

type AssetsData = {
  audio: {
    english: string;
    japanese: string;
  };
  imagePrompt?: string;
  composite?: string | null;
};

export default function PromptTestPage() {
  const [problem, setProblem] = useState<GeneratedProblem | null>(null);
  const [assets, setAssets] = useState<AssetsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const generateProblem = async (type: 'short' | 'medium' | 'long') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/problem/test-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, withoutPicture: WITHOUT_PICTURE }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate problem');
      }

      const data = await response.json();
      setProblem(data.problem);
      setAssets(data.assets);

      // 問題生成後に自動で音声再生を開始
      if (data.assets?.audio) {
        setTimeout(() => {
          playAudioSequenceWithAssets(data.assets);
        }, 500); // 少し遅延を入れてUIが更新されてから再生
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const playAudioSequenceWithAssets = async (audioAssets: AssetsData) => {
    if (!audioAssets?.audio || isPlaying) return;

    setIsPlaying(true);

    try {
      // 英語音声を再生
      const englishAudio = new Audio(audioAssets.audio.english);
      await new Promise<void>((resolve, reject) => {
        englishAudio.onended = () => resolve();
        englishAudio.onerror = () => reject(new Error('English audio failed'));
        englishAudio.play();
      });

      // 少し間を空ける
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 日本語音声を再生
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">プロンプトテスト</h1>
        <p className="text-center text-gray-600 mb-8">
          問題生成後、自動で音声が再生されます（英語→日本語の順）
        </p>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex gap-4 justify-center mb-6">
            <button
              onClick={() => generateProblem('short')}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              短文生成
            </button>
            <button
              onClick={() => generateProblem('medium')}
              disabled={loading}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              中文生成
            </button>
            <button
              onClick={() => generateProblem('long')}
              disabled={loading}
              className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              長文生成
            </button>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">生成中...</p>
            </div>
          )}

          {isPlaying && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 border border-green-300 rounded-lg">
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-green-800 font-medium">🔊 音声再生中...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-600">エラー: {error}</p>
            </div>
          )}

          {problem && !loading && (
            <div className="space-y-6">
              {/* 画像生成プロンプトを常に表示 */}
              {assets?.imagePrompt && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-amber-800 mb-2">画像生成プロンプト</h3>
                  <div className="text-sm text-amber-700 leading-relaxed whitespace-pre-line bg-white border border-amber-200 rounded p-3">
                    {assets.imagePrompt}
                  </div>
                </div>
              )}

              {/* 生成された画像を表示 */}
              {assets?.composite && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-purple-800 mb-2">生成された画像</h3>
                  <div className="flex justify-center">
                    <Image
                      src={assets.composite}
                      alt="Generated scene illustration"
                      width={400}
                      height={600}
                      className="max-w-full h-auto rounded-lg shadow-md"
                      unoptimized={true}
                    />
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">英文</h3>
                <p className="text-xl text-blue-900 font-medium">{problem.english}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-2">日本語返答</h3>
                <p className="text-xl text-green-900 font-medium">{problem.japaneseReply}</p>
              </div>

              {/* 選択肢を日本語返答の下に追加 */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-orange-800 mb-4">選択肢</h3>
                <div className="space-y-3">
                  {problem.options.map((option, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-2 ${
                        index === problem.correctIndex
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-sm px-2 py-1 rounded ${
                            index === problem.correctIndex
                              ? 'bg-green-200 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                        {index === problem.correctIndex && (
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
                  <p className="text-purple-700">{problem.sceneId}</p>
                </div>
                {problem.characterRoles && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded p-3">
                    <span className="font-semibold text-cyan-800">キャラクター:</span>
                    <p className="text-cyan-700">
                      {problem.characterRoles.character1} → {problem.characterRoles.character2}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
