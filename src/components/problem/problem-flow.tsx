'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProblemWithAudio } from '@/app/api/problems/route';
import { SceneImage } from '@/components/ui/scene-image';
import { StartButton } from '@/components/ui/start-button';
import { shuffleOptionsWithCorrectIndex } from '@/lib/shuffle-utils';

// 直和型によるPhase定義
type Phase =
  | {
      kind: 'start-button';
      error: string | null;
      problem: ProblemWithAudio;
    }
  | {
      kind: 'scene-entry';
      problem: ProblemWithAudio;
    }
  | {
      kind: 'scene-ready';
      problem: ProblemWithAudio;
    }
  | {
      kind: 'quiz';
      problem: ProblemWithAudio;
      shuffledOptions: string[];
      correctIndex: number;
    }
  | {
      kind: 'correct';
      problem: ProblemWithAudio;
    }
  | {
      kind: 'incorrect';
      problem: ProblemWithAudio;
    };

export type ProblemLength = 'short' | 'medium' | 'long';

type ProblemFlowProps = {
  length: ProblemLength;
  initialProblem: ProblemWithAudio;
};

type ApiProblemsResponse = {
  problems: ProblemWithAudio[];
  count: number;
};

type Setting = {
  isEnglishMode: boolean;
  isImageHiddenMode: boolean;
  correctStreak: number;
};

const getCurrentSetting = (length: ProblemLength): Setting => {
  if (typeof window === 'undefined')
    return {
      isEnglishMode: false,
      isImageHiddenMode: false,
      correctStreak: 0,
    };

  const correctStreakCount = localStorage.getItem(`correctStreak-${length}`);

  return {
    isEnglishMode: localStorage.getItem('englishMode') === 'true',
    isImageHiddenMode: localStorage.getItem('noImageMode') === 'true',
    correctStreak: Number(correctStreakCount) ?? 0,
  };
};

export default function ProblemFlow({ length, initialProblem }: ProblemFlowProps) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() ?? '';
  const router = useRouter();
  const pathname = usePathname();

  // 直和型のphase状態（統合）
  const [phase, setPhase] = useState<Phase>({
    kind: 'start-button',
    error: null,
    problem: initialProblem,
  });

  // グローバル状態（全phase共通）
  const [problemQueue, setProblemQueue] = useState<ProblemWithAudio[]>([initialProblem]);
  const [isAudioBusy, setAudioBusy] = useState(false);

  // 現在の問題と画像を取得
  const currentProblem = phase.kind === 'start-button' ? initialProblem : phase.problem;
  const sceneImage = currentProblem?.imageUrl ?? null;
  const nextProblem = problemQueue[1] ?? null;
  const englishSentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const japaneseReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const englishReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(false);
  const isPrefetchingNextRef = useRef(false);
  const lastQueueLengthRef = useRef(0);

  // Setting型の部分更新でlocalStorageとrefを同時に更新する関数
  const updateSetting = useCallback(
    (updates: Partial<Setting>) => {
      if (typeof window === 'undefined') return;

      const currentSetting = getCurrentSetting(length);

      const settingKeys = {
        isEnglishMode: 'englishMode',
        isImageHiddenMode: 'noImageMode',
        correctStreak: `correctStreak-${length}`,
      } as const satisfies Record<keyof Setting, string>;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && currentSetting[key as keyof Setting] !== value) {
          const storageKey = settingKeys[key as keyof typeof settingKeys];
          localStorage.setItem(storageKey, value.toString());
        }
      });
    },
    [length],
  );

  const setting = getCurrentSetting(length);

  // ProblemLength を直接使用
  const playAudio = useCallback((audio: HTMLAudioElement | null, duration: number) => {
    if (!audio) return;

    audio.load();

    setTimeout(() => {
      setAudioBusy(true);
      audio.play().catch(() => {
        console.warn('英語音声の再生に失敗しました。');
        setAudioBusy(false);
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

    // --- phaseごとの副作用をここに統合 ---
    switch (phase.kind) {
      case 'scene-entry': {
        const shouldSkipImage = !sceneImage || setting.isImageHiddenMode;
        if (shouldSkipImage) {
          setPhase({
            kind: 'scene-ready',
            problem: phase.problem,
          });
        }

        if (!isPrefetchingNextRef.current) {
          void refillQueueIfNeeded();
        }
        break;
      }
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [phase, refillQueueIfNeeded, sceneImage, setting]);

  const handleStart = () => {
    setPhase({
      kind: 'scene-entry',
      problem: initialProblem,
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleRetryQuiz = () => {
    if (phase.kind === 'incorrect') {
      setPhase({
        kind: 'scene-entry',
        problem: phase.problem,
      });
      void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
    }
  };

  const handleReplyAudioEnded = () => {
    setAudioBusy(false);

    const { options: shuffledOptions, correctIndex: shuffledCorrectIndex } =
      shuffleOptionsWithCorrectIndex(
        currentProblem.japaneseSentence,
        currentProblem.incorrectOptions,
      );

    if (phase.kind === 'scene-entry' || phase.kind === 'scene-ready') {
      setPhase({
        kind: 'quiz',
        problem: phase.problem,
        shuffledOptions,
        correctIndex: shuffledCorrectIndex,
      });
      void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
    }
  };

  const handleNextProblem = () => {
    if (isPrefetchingNextRef.current) return;

    // searchパラメータがある場合のみURLをクリア
    if (searchQuery) {
      router.push(pathname);
    }

    // キューから先頭を削除して、次の問題を取得
    const nextProblemData = problemQueue[1];

    if (!nextProblemData) {
      // キューが空の場合はエラー状態にする
      console.error('[ProblemFlow] 問題キューが空です');
      setPhase({
        kind: 'start-button',
        error: '次の問題がありません',
        problem: currentProblem,
      });
      return;
    }

    // キューから現在の問題を削除して次の問題をセット
    setProblemQueue((prev) => prev.slice(1));

    // 切り替え直後に英語音声を再生
    setPhase({
      kind: 'scene-entry',
      problem: nextProblemData,
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const isOnStreak = [5, 10, 20, 30, 50, 100].includes(setting.correctStreak);

  return (
    <>
      {phase.kind === 'start-button' && (
        <div className="relative max-w-[500px] mx-auto aspect-[2/3]">
          {sceneImage && (
            <SceneImage
              src={sceneImage}
              alt="英語と日本語のセリフを並べた2コマシーン"
              opacity="medium"
            />
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            <StartButton error={phase.error} handleStart={handleStart} disabled={isAudioBusy}>
              英語学習を始める
            </StartButton>
          </div>
        </div>
      )}
      {/* シーン表示（scene-entry / scene-ready 限定） */}
      {(phase.kind === 'scene-entry' || phase.kind === 'scene-ready') && (
        <>
          {/* 画像がある場合の表示 */}
          {sceneImage && !setting.isImageHiddenMode ? (
            <section className="grid place-items-center">
              <figure className="flex w-full justify-center">
                <SceneImage
                  src={sceneImage}
                  alt="英語と日本語のセリフを並べた2コマシーン"
                  opacity="full"
                  onLoad={() => {
                    console.log('[ProblemFlow] 画像読み込み完了');
                    if (phase.kind === 'scene-entry') {
                      setPhase({
                        kind: 'scene-ready',
                        problem: phase.problem,
                      });
                    }
                  }}
                />
              </figure>
            </section>
          ) : (
            <section className="grid place-items-center">
              <div className="w-full max-w-[500px] p-6 text-center text-[#2a2b3c] leading-relaxed bg-white rounded-lg border border-[#d8cbb6]">
                <h3 className="font-semibold mb-3 text-lg text-[#2f8f9d]">シーン</h3>
                <p className="font-bold text-2xl">{phase.problem.place}</p>
              </div>
            </section>
          )}
        </>
      )}

      {phase.kind === 'quiz' && (
        <section className="grid gap-6 sm:gap-8">
          <div>
            <p className="text-xl font-semibold text-[#2a2b3c] sm:text-2xl">この英文の意味は？</p>
          </div>
          <ul className="grid gap-3">
            {phase.shuffledOptions.map((option, index) => (
              <li key={`${option}-${index}`}>
                <button
                  type="button"
                  onClick={() => {
                    const isCorrect = index === phase.correctIndex;
                    if (isCorrect) {
                      // 連続正解数をインクリメント（localStorageとrefを同時更新）
                      const newStreak = setting.correctStreak + 1;
                      updateSetting({ correctStreak: newStreak });

                      setPhase({
                        kind: 'correct',
                        problem: phase.problem,
                      });
                      // 正解だったらクリック時に再生
                      void (
                        englishSentenceAudioRef.current &&
                        playAudio(englishSentenceAudioRef.current, 0)
                      );
                    } else {
                      // 連続正解数をリセット（localStorageとrefを同時更新）
                      updateSetting({ correctStreak: 0 });

                      setPhase({
                        kind: 'incorrect',
                        problem: phase.problem,
                      });
                    }
                  }}
                  className="w-full rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-left text-base font-medium text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 enabled:hover:border-[#2f8f9d] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d]  disabled:opacity-50"
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
                playAudio(englishSentenceAudioRef.current, 0);
              }}
              className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 enabled:hover:bg-[#257682] disabled:opacity-60"
              disabled={!phase.problem.audioEnUrl || isAudioBusy}
            >
              もう一度聞く
            </button>
          </div>
        </section>
      )}

      {phase.kind === 'correct' && (
        <section className="grid gap-4 text-center">
          <div className="px-6 py-2 text-cyan-600">
            <h2 className="text-4xl font-bold">
              {isOnStreak ? `${setting.correctStreak}問連続 ` : ''}
              正解 🎉
            </h2>
            <div className="mt-6 flex justify-center max-w-[40%] sm:max-w-[160px] mx-auto relative">
              <Image
                src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/correct1.webp`}
                alt="ガッツポーズ"
                width={500}
                height={750}
                unoptimized
                className={isOnStreak ? 'opacity-50' : ''}
              />
              {isOnStreak && (
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}?share=${setting.correctStreak}`;
                    const tweetText = `【英語きわめ太郎】${setting.correctStreak}問連続正解しました！`;
                    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
                    window.open(twitterUrl, '_blank', 'width=550,height=420');
                  }}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-black px-6 py-3 text-base font-semibold text-white shadow-lg shadow-black/50 enabled:hover:bg-gray-800"
                >
                  𝕏 で自慢する
                </button>
              )}
            </div>
            <p className="mt-4 text-2xl font-semibold text-[#2a2b3c]">
              {phase.problem.englishSentence}
            </p>
            <p className="mt-4 text-lg text-[#2a2b3c]">{phase.problem.japaneseSentence}</p>
          </div>
          <div className="flex flex-col gap-3 items-center justify-center">
            <button
              type="button"
              onClick={handleNextProblem}
              className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 enabled:hover:bg-[#c3684f] disabled:opacity-60"
              disabled={isAudioBusy}
            >
              次の問題へ
            </button>
          </div>
        </section>
      )}

      {phase.kind === 'incorrect' && (
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
              className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:opacity-60"
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
        src={currentProblem.audioEnUrl}
        preload="auto"
        onEnded={() => {
          setAudioBusy(false);
          if (phase.kind === 'quiz' || phase.kind === 'correct') return;
          // scene-entry/scene-ready時のみ、返答音声を続けて再生
          const replyAudioRef = setting.isEnglishMode
            ? englishReplyAudioRef
            : japaneseReplyAudioRef;
          void (replyAudioRef.current && playAudio(replyAudioRef.current, 0));
        }}
      />
      <audio
        key="currentJapaneseReply"
        ref={japaneseReplyAudioRef}
        src={currentProblem.audioJaUrl}
        preload="auto"
        onEnded={handleReplyAudioEnded}
      />
      <audio
        key="currentEnglishReply"
        ref={englishReplyAudioRef}
        src={currentProblem.audioEnReplyUrl}
        preload="auto"
        onEnded={handleReplyAudioEnded}
      />
      {/* 次の問題の音声と画像 */}
      {nextProblem && (
        <>
          <audio key="nextEnglishSentence" src={nextProblem.audioEnUrl} preload="auto" />
          <audio key="nextJapaneseReply" src={nextProblem.audioJaUrl} preload="auto" />
          <audio key="nextEnglishReply" src={nextProblem.audioEnReplyUrl} preload="auto" />
          {nextProblem.imageUrl && (
            <Image
              unoptimized
              priority
              src={nextProblem.imageUrl}
              className="hidden"
              width={500}
              height={750}
              alt="次の問題の画像"
            />
          )}
        </>
      )}
    </>
  );
}
