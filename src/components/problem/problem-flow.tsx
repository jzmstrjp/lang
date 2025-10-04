'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProblemWithAudio } from '@/app/api/problems/route';
import { SceneImage } from '@/components/ui/scene-image';
import { StartButton } from '@/components/ui/start-button';
import { shuffleOptionsWithCorrectIndex } from '@/lib/shuffle-utils';

type Phase = 'landing' | 'scene-entry' | 'scene-ready' | 'quiz' | 'correct' | 'incorrect';

export type ProblemLength = 'short' | 'medium' | 'long';

type ProblemFlowProps = {
  length: ProblemLength;
  initialProblem: ProblemWithAudio;
};

type ApiProblemsResponse = {
  problems: ProblemWithAudio[];
  count: number;
};

// 選択肢をシャッフルして正解のインデックスを返す
function shuffleOptions(target: ProblemWithAudio): { options: string[]; correctIndex: number } {
  return shuffleOptionsWithCorrectIndex(target.japaneseSentence, target.incorrectOptions);
}

export default function ProblemFlow({ length, initialProblem }: ProblemFlowProps) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() ?? '';
  const router = useRouter();
  const pathname = usePathname();
  type AudioStatus = 'idle' | 'playing';

  type FetchPhase = 'idle' | 'bootstrapping' | 'loading' | 'prefetch';

  const [phase, setPhase] = useState<Phase>('landing');
  const [problem, setProblem] = useState<ProblemWithAudio>(initialProblem);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [problemQueue, setProblemQueue] = useState<ProblemWithAudio[]>([initialProblem]);
  const [fetchPhase, setFetchPhase] = useState<FetchPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');

  const isFetching = fetchPhase === 'bootstrapping' || fetchPhase === 'loading';
  const isAudioBusy = audioStatus !== 'idle';

  const sceneImage = problem?.imageUrl ?? null;
  const nextProblem = problemQueue[1] ?? null;
  const nextSceneImage = nextProblem?.imageUrl ?? null;
  const shuffledOptions = options;

  const englishSentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const japaneseReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const englishReplyAudioRef = useRef<HTMLAudioElement | null>(null);

  const [viewPhase, setViewPhase] = useState<Phase>('landing');
  const isMountedRef = useRef(false);
  const isPrefetchingNextRef = useRef(false);
  const isFirstQuiz = useRef(true);
  const [mounted, setMounted] = useState(false);
  const lastQueueLengthRef = useRef(0);

  const settingsRef = useRef({
    isEnglishMode: true,
    isImageHiddenMode: false,
  });
  const loadSettings = () => {
    if (typeof window === 'undefined') return;

    settingsRef.current = {
      isEnglishMode: localStorage.getItem('englishMode') === 'true',
      isImageHiddenMode: localStorage.getItem('noImageMode') === 'true',
    };
  };

  // ProblemLength を直接使用
  const playAudio = useCallback((audio: HTMLAudioElement | null, duration: number) => {
    if (!audio) return;

    setAudioStatus('playing');
    audio.load();

    setTimeout(() => {
      audio.play().catch(() => {
        console.warn('英語音声の再生に失敗しました。');
        setAudioStatus('idle');
      });
    }, 100 + duration);
  }, []);

  console.log(`[ProblemFlow] キュー${problemQueue.length}件`);

  // キューに次の問題がなければ追加で問題を取得（常に検索なし）
  const refillQueueIfNeeded = useCallback(async () => {
    // 次の問題（problemQueue[1]）がある、または既に補充中なら何もしない
    if (problemQueue.length > 1 || isPrefetchingNextRef.current) return;

    console.log('[ProblemFlow] キュー補充チェック: 補充開始');
    isPrefetchingNextRef.current = true;

    try {
      // 補充時は常に検索なしで取得
      const params = new URLSearchParams({ type: length });
      const response = await fetch(`/api/problems?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiProblemsResponse = await response.json();

        // 新しい問題が取得できなかった場合は、これ以上補充しない
        if (data.problems.length === 0) {
          console.log('[ProblemFlow] 問題キュー補充: 新しい問題がありません');
          return;
        }

        setProblemQueue((prev) => {
          const newQueue = [...prev, ...data.problems];
          lastQueueLengthRef.current = newQueue.length;
          return newQueue;
        });
        console.log('[ProblemFlow] 問題キュー補充完了:', data.count, '件追加');
      }
    } catch (err) {
      console.warn('[ProblemFlow] 問題キュー補充失敗:', err);
    } finally {
      isPrefetchingNextRef.current = false;
    }
  }, [length, problemQueue.length]);

  // phaseごとの処理
  useEffect(() => {
    isMountedRef.current = true;
    loadSettings();

    // --- phaseごとの副作用をここに統合 ---
    switch (phase) {
      case 'landing':
        // マウント完了フラグを立てる
        if (!mounted) setMounted(true);
        break;

      case 'scene-entry':
        const shouldSkipImage = !sceneImage || settingsRef.current.isImageHiddenMode;
        if (shouldSkipImage) {
          setPhase('scene-ready');
        }

        if (!isPrefetchingNextRef.current) {
          void refillQueueIfNeeded();
        }
        break;
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [mounted, phase, sceneImage, refillQueueIfNeeded]);

  // 初回のbootstrap処理
  useEffect(() => {
    if (isFirstQuiz.current) {
      isFirstQuiz.current = false;
      isPrefetchingNextRef.current = false;

      const bootstrap = async () => {
        setFetchPhase('bootstrapping');

        try {
          // 初期問題はすでにキューに入っているので、追加の問題を取得
          console.log('[ProblemFlow] 初期問題をサーバーから取得済み');

          // 追加の問題を取得
          const params = new URLSearchParams({ type: length });
          const response = await fetch(`/api/problems?${params.toString()}`, {
            cache: 'no-store',
          });

          if (response.ok) {
            const data: ApiProblemsResponse = await response.json();
            // 追加の問題をシャッフルしてキューに追加
            setProblemQueue((prev) => {
              const newQueue = [...prev, ...data.problems];
              lastQueueLengthRef.current = newQueue.length;
              return newQueue;
            });
            console.log('[ProblemFlow] 追加問題取得:', data.count, '件');
          }

          // 最初の問題（initialProblem）の選択肢をセット
          const { options, correctIndex: newCorrectIndex } = shuffleOptions(initialProblem);

          setOptions(options);
          setCorrectIndex(newCorrectIndex);
          setFetchPhase('idle');
          console.log('[ProblemFlow] 問題キュー準備完了');
        } catch (err) {
          console.error('[ProblemFlow] 問題取得失敗:', err);
          const message = err instanceof Error ? err.message : '問題取得に失敗しました';
          setError(message);
          setPhase('landing');
          setFetchPhase('idle');
        }
      };

      void bootstrap();
    }
  }, [initialProblem, length]);

  const handleStart = () => {
    setViewPhase('scene-entry');
    setPhase('scene-entry');
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleRetryQuiz = () => {
    setViewPhase('scene-entry');
    setPhase('scene-entry');
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleReplyAudioEnded = () => {
    setAudioStatus('idle');
    setViewPhase('quiz');
    setPhase('quiz');
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleNextProblem = () => {
    if (isFetching) return;

    // searchパラメータがある場合のみURLをクリア
    if (searchQuery) {
      router.push(pathname);
    }

    // キューから先頭を削除して、次の問題を取得
    const nextProblemData = problemQueue[1];

    if (!nextProblemData) {
      // キューが空の場合はローディング状態にする
      console.error('[ProblemFlow] 問題キューが空です');
      setPhase('landing');
      setError('次の問題がありません');
      return;
    }

    const { options: newOptions, correctIndex: newCorrectIndex } = shuffleOptions(nextProblemData);

    // キューから現在の問題を削除
    setProblemQueue((prev) => prev.slice(1));
    setProblem(nextProblemData);
    setOptions(newOptions);
    setCorrectIndex(newCorrectIndex);

    // 切り替え直後に英語音声を再生
    setPhase('scene-entry');
    setViewPhase('scene-entry');
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  return (
    <>
      {phase === 'landing' && (
        <div className="relative max-w-[500px] mx-auto aspect-[2/3]">
          {sceneImage && (
            <SceneImage
              src={sceneImage}
              alt="英語と日本語のセリフを並べた2コマシーン"
              opacity="medium"
            />
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            <StartButton error={error} handleStart={handleStart} disabled={isAudioBusy}>
              英語学習を始める
            </StartButton>
          </div>
        </div>
      )}
      {sceneImage && (
        <section
          className={`grid place-items-center ${settingsRef.current.isImageHiddenMode ? 'hidden' : ''}`}
        >
          <figure className="flex w-full justify-center">
            <SceneImage
              src={sceneImage}
              alt="英語と日本語のセリフを並べた2コマシーン"
              opacity="full"
              className={phase === 'scene-entry' || phase === 'scene-ready' ? 'block' : 'hidden'}
              onLoad={() => {
                console.log('[ProblemFlow] 画像読み込み完了');
                if (phase === 'scene-entry') {
                  setPhase('scene-ready');
                }
              }}
            />
          </figure>
        </section>
      )}

      {/* 画像がない or 画像なしモードの場合のシーン表示（scene-entry / scene-ready 限定） */}
      {(phase === 'scene-entry' || phase === 'scene-ready') &&
        (!sceneImage || settingsRef.current.isImageHiddenMode) && (
          <section className="grid place-items-center">
            <div className="w-full max-w-[500px] p-6 text-center text-[#2a2b3c] leading-relaxed bg-white rounded-lg border border-[#d8cbb6]">
              <h3 className="font-semibold mb-3 text-lg text-[#2f8f9d]">シーン</h3>
              <p className="font-bold text-2xl">{problem.place}</p>
            </div>
          </section>
        )}

      {phase === 'quiz' && problem && (
        <section className="grid gap-6 sm:gap-8">
          <div>
            <p className="text-xl font-semibold text-[#2a2b3c] sm:text-2xl">この英文の意味は？</p>
          </div>
          <ul className="grid gap-3">
            {shuffledOptions.map((option, index) => (
              <li key={`${option}-${index}`}>
                <button
                  type="button"
                  onClick={() => {
                    const isCorrect = index === correctIndex;
                    setViewPhase(isCorrect ? 'correct' : 'incorrect');
                    setPhase(isCorrect ? 'correct' : 'incorrect');
                    if (isCorrect) {
                      // 正解だったらクリック時に再生
                      void (
                        englishSentenceAudioRef.current &&
                        playAudio(englishSentenceAudioRef.current, 0)
                      );
                    }
                  }}
                  className="w-full rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-left text-base font-medium text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#2f8f9d] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d]  disabled:opacity-50"
                  disabled={isAudioBusy}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setViewPhase('quiz');
                setPhase('quiz');
                playAudio(englishSentenceAudioRef.current, 0);
              }}
              className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:opacity-60"
              disabled={!problem.audioEnUrl || isAudioBusy}
            >
              もう一度聞く
            </button>
          </div>
        </section>
      )}

      {phase === 'correct' && (
        <section className="grid gap-4 text-center">
          <div className="px-6 py-2 text-cyan-600">
            <h2 className="text-4xl font-bold">正解 🎉</h2>
            <div className="mt-6 flex justify-center max-w-[40%] sm:max-w-[160px] mx-auto">
              <Image
                src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/correct1.webp`}
                alt="ガッツポーズ"
                width={500}
                height={750}
                unoptimized
              />
            </div>
            <p className="mt-4 text-2xl font-semibold text-[#2a2b3c]">{problem.englishSentence}</p>
            <p className="mt-4 text-lg text-[#2a2b3c]">{problem.japaneseSentence}</p>
          </div>
          <div className="flex flex-row gap-3 items-center justify-center">
            <button
              type="button"
              onClick={handleNextProblem}
              className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 transition enabled:hover:bg-[#c3684f] disabled:opacity-60"
              disabled={isAudioBusy}
            >
              次の問題へ
            </button>
          </div>
        </section>
      )}

      {phase === 'incorrect' && (
        <section className="grid gap-4 text-center">
          <div className="px-6 py-2 text-blue-600">
            <h2 className="text-4xl font-bold pl-4">残念…</h2>
            <div className="mt-6 flex justify-center max-w-[40%] sm:max-w-[160px] mx-auto">
              <Image
                src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/incorrect1.webp?1`}
                alt="ショックな様子"
                width={500}
                height={750}
                unoptimized
              />
            </div>
          </div>
          <div className="flex flex-row gap-3 items-center justify-center">
            <button
              type="button"
              onClick={handleRetryQuiz}
              className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:opacity-60"
              disabled={isAudioBusy}
            >
              再挑戦
            </button>
          </div>
        </section>
      )}

      <audio
        key="currentEnglishSentence"
        ref={englishSentenceAudioRef}
        src={problem.audioEnUrl}
        preload="auto"
        onEnded={() => {
          setAudioStatus('idle');

          if (viewPhase === 'quiz' || viewPhase === 'correct') return;
          // scene-entry/scene-ready時のみ、返答音声を続けて再生
          const replyAudioRef = settingsRef.current.isEnglishMode
            ? englishReplyAudioRef
            : japaneseReplyAudioRef;
          setViewPhase(viewPhase);
          setPhase(phase);
          void (replyAudioRef.current && playAudio(replyAudioRef.current, 0));
        }}
      />
      <audio
        key="currentJapaneseReply"
        ref={japaneseReplyAudioRef}
        src={problem.audioJaUrl}
        preload="auto"
        onEnded={handleReplyAudioEnded}
      />
      <audio
        key="currentEnglishReply"
        ref={englishReplyAudioRef}
        src={problem.audioEnReplyUrl}
        preload="auto"
        onEnded={handleReplyAudioEnded}
      />
      {nextProblem && (
        <>
          <audio key="nextEnglishSentence" src={nextProblem.audioEnUrl} preload="auto" />
          <audio key="nextJapaneseReply" src={nextProblem.audioJaUrl} preload="auto" />
          <audio key="nextEnglishReply" src={nextProblem.audioEnReplyUrl} preload="auto" />
        </>
      )}
      {/* キャッシュを用意するために次の問題の画像を読み込む */}
      {nextSceneImage && (
        <Image
          unoptimized
          priority
          src={nextSceneImage}
          className="hidden"
          width={500}
          height={750}
          alt="次の問題の画像"
        />
      )}
    </>
  );
}
