'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ProblemWithAudio } from '@/app/api/problems/route';
import { SceneImage } from '@/components/ui/scene-image';
import { StartButton } from '@/components/ui/start-button';
import { shuffleOptionsWithCorrectIndex } from '@/lib/shuffle-utils';
import { ALLOWED_SHARE_COUNTS } from '@/const';

type ServerPhase = {
  problem: ProblemWithAudio;
} & {
  kind: 'start-button-server';
};

type ClientPhase = {
  setting: Setting;
  problem: ProblemWithAudio;
} & (
  | {
      kind: 'start-button-client';
      error: string | null;
    }
  | {
      kind: 'scene-entry';
    }
  | {
      kind: 'scene-ready';
    }
  | {
      kind: 'quiz';
      shuffledOptions: string[];
      correctIndex: number;
    }
  | {
      kind: 'correct';
    }
  | {
      kind: 'incorrect';
    }
);

type Phase = ServerPhase | ClientPhase;

export type ProblemLength = 'short' | 'medium' | 'long';

type ProblemFlowProps = {
  length: ProblemLength;
  initialProblem: ProblemWithAudio;
  isAdmin: boolean;
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

export default function ProblemFlow({ length, initialProblem, isAdmin }: ProblemFlowProps) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() ?? '';
  const router = useRouter();
  const pathname = usePathname();

  // 直和型のphase状態（統合）
  const [phase, setPhase] = useState<Phase>({
    kind: 'start-button-server',
    problem: initialProblem,
  });

  // グローバル状態（全phase共通）
  const [problemQueue, setProblemQueue] = useState<ProblemWithAudio[]>([initialProblem]);
  const [isAudioBusy, setAudioBusy] = useState(false);
  // 現在の問題と画像を取得
  const currentProblem = phase.problem;
  const sceneImage = currentProblem?.imageUrl ?? null;
  const nextProblem = problemQueue[1] ?? null;
  const phaseSetting = phase.kind === 'start-button-server' ? null : phase.setting;
  const englishSentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const japaneseReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const englishReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPrefetchingNextRef = useRef(false);
  const lastQueueLengthRef = useRef(0);
  const isRemovingImageRef = useRef(false);

  const persistSetting = useCallback(
    (prevSetting: Setting, nextSetting: Setting) => {
      if (typeof window === 'undefined') return;

      const keys = {
        isEnglishMode: 'englishMode',
        isImageHiddenMode: 'noImageMode',
        correctStreak: `correctStreak-${length}`,
      } as const satisfies Record<keyof Setting, string>;

      (Object.keys(keys) as Array<keyof Setting>).forEach((key) => {
        if (prevSetting[key] !== nextSetting[key]) {
          const storageKey = keys[key];
          localStorage.setItem(storageKey, nextSetting[key].toString());
        }
      });
    },
    [length],
  );

  // ProblemLength を直接使用
  const playAudio = useCallback((audio: HTMLAudioElement | null, duration: number) => {
    if (!audio) return;

    audio.load();
    setAudioBusy(true);

    setTimeout(() => {
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
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    // --- phaseごとの副作用をここに統合 ---
    switch (phase.kind) {
      case 'start-button-server': {
        setPhase({
          kind: 'start-button-client',
          error: null,
          problem: phase.problem,
          setting: getCurrentSetting(length),
        });
        break;
      }
      case 'scene-entry': {
        const shouldSkipImage = !sceneImage || phase.setting.isImageHiddenMode;
        if (shouldSkipImage) {
          setPhase({
            kind: 'scene-ready',
            problem: phase.problem,
            setting: getCurrentSetting(length),
          });
        }

        if (!isPrefetchingNextRef.current) {
          void refillQueueIfNeeded();
        }
        break;
      }
    }
  }, [length, phase, refillQueueIfNeeded, sceneImage]);

  const handleStart = () => {
    if (phase.kind !== 'start-button-client') return;

    setPhase({
      kind: 'scene-entry',
      problem: phase.problem,
      setting: getCurrentSetting(length),
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleRetryQuiz = () => {
    if (phase.kind === 'incorrect') {
      setPhase({
        kind: 'scene-entry',
        problem: phase.problem,
        setting: getCurrentSetting(length),
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
        setting: getCurrentSetting(length),
      });
      void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
    }
  };

  const handleNextProblem = () => {
    if (phase.kind === 'start-button-server') return;

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
        kind: 'start-button-client',
        error: '次の問題がありません',
        problem: currentProblem,
        setting: getCurrentSetting(length),
      });
      return;
    }

    // キューから現在の問題を削除して次の問題をセット
    setProblemQueue((prev) => prev.slice(1));

    // 切り替え直後に英語音声を再生
    setPhase({
      kind: 'scene-entry',
      problem: nextProblemData,
      setting: getCurrentSetting(length),
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleRemoveImage = async () => {
    if (!window.confirm('本当にこの問題の画像を削除しますか？')) return;

    const targetProblemId = currentProblem?.id;
    if (!isAdmin || !targetProblemId || !currentProblem.imageUrl || isRemovingImageRef.current) {
      return;
    }

    isRemovingImageRef.current = true;

    try {
      const response = await fetch('/api/admin/problems/remove-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ problemId: targetProblemId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? '画像の削除に失敗しました。');
      }

      setPhase((prevPhase) => {
        const updatedProblem = { ...prevPhase.problem, imageUrl: null };
        return { ...prevPhase, problem: updatedProblem } as Phase;
      });
    } catch (error) {
      console.error('[ProblemFlow] 画像削除エラー:', error);
    } finally {
      isRemovingImageRef.current = false;
    }
  };

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSettingChange = () => {
      setPhase((prev) => {
        if (prev.kind !== 'start-button-client') return prev;
        const refreshedSetting = getCurrentSetting(length);
        return {
          ...prev,
          setting: refreshedSetting,
        };
      });
    };

    window.addEventListener('problem-setting-change', handleSettingChange);

    return () => {
      window.removeEventListener('problem-setting-change', handleSettingChange);
    };
  }, [length]);

  const isOnStreak =
    phaseSetting !== null &&
    ALLOWED_SHARE_COUNTS.includes(
      phaseSetting.correctStreak as (typeof ALLOWED_SHARE_COUNTS)[number],
    );

  return (
    <>
      {phase.kind === 'start-button-server' ? (
        <div className="relative max-w-[500px] mx-auto aspect-[2/3]">
          <div className="absolute inset-0 flex items-center justify-center">
            <StartButton error={null} handleStart={handleStart} disabled={isAudioBusy}>
              英語学習を始める
            </StartButton>
          </div>
        </div>
      ) : phase.kind === 'start-button-client' ? (
        <div className="relative max-w-[500px] mx-auto aspect-[2/3]">
          <SceneDisplay
            imageUrl={sceneImage}
            place={phase.problem.place}
            isHidden={phase.setting.isImageHiddenMode}
            opacity="medium"
            onImageLoad={undefined}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <StartButton error={phase.error} handleStart={handleStart} disabled={isAudioBusy}>
              英語学習を始める
            </StartButton>
          </div>
        </div>
      ) : phase.kind === 'scene-entry' ? (
        <SceneDisplay
          imageUrl={sceneImage}
          place={phase.problem.place}
          isHidden={phase.setting.isImageHiddenMode}
          opacity="full"
          onImageLoad={() => {
            console.log('[ProblemFlow] 画像読み込み完了');
            setPhase({
              kind: 'scene-ready',
              problem: phase.problem,
              setting: getCurrentSetting(length),
            });
          }}
        />
      ) : phase.kind === 'scene-ready' ? (
        <SceneDisplay
          imageUrl={sceneImage}
          place={phase.problem.place}
          isHidden={phase.setting.isImageHiddenMode}
          opacity="full"
          onImageLoad={undefined}
        />
      ) : phase.kind === 'quiz' ? (
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
                      const prevSetting = phase.setting;
                      const newSetting: Setting = {
                        ...prevSetting,
                        correctStreak: prevSetting.correctStreak + 1,
                      };
                      persistSetting(prevSetting, newSetting);

                      setPhase({
                        kind: 'correct',
                        problem: phase.problem,
                        setting: newSetting,
                      });
                      // 正解だったらクリック時に再生
                      void (
                        englishSentenceAudioRef.current &&
                        playAudio(englishSentenceAudioRef.current, 0)
                      );
                    } else {
                      // 連続正解数をリセット（localStorageとrefを同時更新）
                      const prevSetting = phase.setting;
                      const newSetting: Setting = {
                        ...prevSetting,
                        correctStreak: 0,
                      };
                      persistSetting(prevSetting, newSetting);

                      setPhase({
                        kind: 'incorrect',
                        problem: phase.problem,
                        setting: newSetting,
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
      ) : phase.kind === 'correct' ? (
        <section className="grid gap-4 text-center">
          <div className="px-6 py-2 text-cyan-600">
            <h2 className="text-4xl font-bold">
              {isOnStreak ? `${phase.setting.correctStreak}問連続 ` : ''}
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
                    const courseName = length.charAt(0).toUpperCase() + length.slice(1);
                    const shareUrl = `${window.location.origin}?streak=${phase.setting.correctStreak}`;
                    const tweetText = `【英語きわめ太郎】${courseName}コースで${phase.setting.correctStreak}問連続正解しました！`;
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
      ) : phase.kind === 'incorrect' ? (
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
      ) : (
        (null as never)
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
          const replyAudioRef =
            phaseSetting && phaseSetting.isEnglishMode
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

      {isAdmin && sceneImage && (
        <div className="mt-128 flex justify-center">
          <button
            type="button"
            onClick={handleRemoveImage}
            className="inline-flex items-center justify-center rounded-full bg-rose-600 px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-rose-900/30 transition enabled:hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            この問題の画像を削除
          </button>
        </div>
      )}
    </>
  );
}

// 共通シーン表示コンポーネント
function SceneDisplay({
  imageUrl,
  place,
  isHidden,
  opacity,
  onImageLoad,
}: {
  imageUrl: string | null;
  place: string;
  isHidden: boolean;
  opacity: 'medium' | 'full';
  onImageLoad?: () => void;
}) {
  if (imageUrl && !isHidden) {
    return (
      <section className="grid place-items-center">
        <figure className="flex w-full justify-center">
          <SceneImage
            src={imageUrl}
            alt="英語と日本語のセリフを並べた2コマシーン"
            opacity={opacity}
            onLoad={onImageLoad}
          />
        </figure>
      </section>
    );
  }

  return (
    <section className="grid place-items-center">
      <div className="w-full max-w-[500px] p-6 text-center text-[#2a2b3c] leading-relaxed bg-white rounded-lg border border-[#d8cbb6]">
        <h3 className="font-semibold mb-3 text-lg text-[#2f8f9d]">シーン</h3>
        <p className="font-bold text-2xl">{place}</p>
      </div>
    </section>
  );
}
