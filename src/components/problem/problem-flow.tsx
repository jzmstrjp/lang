'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProblemWithAudio } from '@/app/api/problems/route';
import { StartButton } from '@/components/ui/start-button';

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

// ProblemType enum が削除されたため、直接文字列を使用

// 問題配列をランダムシャッフル（Fisher-Yates）
function shuffleProblems<T>(problems: T[]): T[] {
  const shuffled = [...problems];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 選択肢をシャッフルして正解のインデックスを返す
function shuffleOptions(target: ProblemWithAudio): { options: string[]; correctIndex: number } {
  const allOptions = [target.japaneseSentence, ...target.incorrectOptions];
  const zipped = allOptions.map((option, index) => ({ option, index }));

  for (let i = zipped.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
  }

  const choices = zipped.map((item) => item.option);
  const correct = zipped.findIndex((item) => item.index === 0);

  return { options: choices, correctIndex: correct === -1 ? 0 : correct };
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
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [problemQueue, setProblemQueue] = useState<ProblemWithAudio[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fetchPhase, setFetchPhase] = useState<FetchPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');

  const isFetching = fetchPhase === 'bootstrapping' || fetchPhase === 'loading';
  const isAudioBusy = audioStatus !== 'idle';

  const sceneImage = problem?.imageUrl ?? null;
  const nextProblem = problemQueue[currentIndex + 1] ?? null;
  const nextSceneImage = nextProblem?.imageUrl ?? null;
  const shuffledOptions = options;

  const sentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const replyAudioRef = useRef<HTMLAudioElement | null>(null);

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
  // 正解判定：selectedOption が correctIndex と一致するか
  const isCorrect = useMemo(
    () => problem != null && selectedOption === correctIndex,
    [correctIndex, problem, selectedOption],
  );

  const playAudio = useCallback((audio: HTMLAudioElement | null, duration: number) => {
    if (!audio) return;

    setAudioStatus('playing');
    setTimeout(() => {
      audio.currentTime = 0;
      audio.play().catch(() => {
        console.warn('英語音声の再生に失敗しました。');
        setAudioStatus('idle');
      });
    }, duration);
  }, []);

  // キューが残り1件になったら追加で問題を取得（常に検索なし）
  const refillQueueIfNeeded = useCallback(async () => {
    // 残り1件になったら補充（最後の問題を解いている間に取得できる）
    const remainingProblems = problemQueue.length - currentIndex;
    if (remainingProblems > 1 || isPrefetchingNextRef.current) return;

    isPrefetchingNextRef.current = true;
    const previousLength = problemQueue.length;

    try {
      // 補充時は常に検索なしで取得
      const params = new URLSearchParams({ type: length });
      const response = await fetch(`/api/problems?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiProblemsResponse = await response.json();

        // 新しい問題が取得できなかった場合は、これ以上補充しない
        if (data.problems.length === 0) {
          lastQueueLengthRef.current = previousLength;
          console.log('[ProblemFlow] 問題キュー補充: 新しい問題がありません');
          return;
        }

        setProblemQueue((prev) => [...prev, ...data.problems]);
        lastQueueLengthRef.current = previousLength + data.problems.length;
        console.log('[ProblemFlow] 問題キュー補充完了:', data.count, '件追加');
      }
    } catch (err) {
      console.warn('[ProblemFlow] 問題キュー補充失敗:', err);
    } finally {
      isPrefetchingNextRef.current = false;
    }
  }, [currentIndex, length, problemQueue.length]);

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
        // else の場合は何もしない（画像の onLoad で scene-ready に遷移させる）
        break;
    }

    // キュー補充チェック
    if (problem && !isPrefetchingNextRef.current) {
      void refillQueueIfNeeded();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [phase, sceneImage, isCorrect, problem, refillQueueIfNeeded, mounted]);

  useEffect(() => {
    if (isFirstQuiz.current) {
      isFirstQuiz.current = false;
      isPrefetchingNextRef.current = false;

      const bootstrap = async () => {
        setFetchPhase('bootstrapping');

        try {
          // 初期問題をサーバーから受け取っているので、それを最初に使う
          let allProblems: ProblemWithAudio[] = [initialProblem];
          console.log('[ProblemFlow] 初期問題をサーバーから取得済み');

          // 追加の問題を取得
          const params = new URLSearchParams({ type: length });
          const response = await fetch(`/api/problems?${params.toString()}`, {
            cache: 'no-store',
          });

          if (response.ok) {
            const data: ApiProblemsResponse = await response.json();
            allProblems = [...allProblems, ...data.problems];
            console.log('[ProblemFlow] 追加問題取得:', data.count, '件');
          }

          // 初期問題を最初に固定し、残りをシャッフル
          const [firstProblem, ...normalProblems] = allProblems;
          const shuffledProblems = [firstProblem, ...shuffleProblems(normalProblems)];

          // 最初の問題をセット
          const { options, correctIndex: newCorrectIndex } = shuffleOptions(firstProblem);

          setProblemQueue(shuffledProblems);
          setCurrentIndex(0);
          setProblem(firstProblem);
          setOptions(options);
          setCorrectIndex(newCorrectIndex);
          setSelectedOption(null);
          setFetchPhase('idle');
          lastQueueLengthRef.current = allProblems.length;
          console.log('[ProblemFlow] 問題キュー準備完了:', allProblems.length, '件');
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
  }, [length, searchQuery, initialProblem]);

  const handleStart = () => {
    setViewPhase('scene-entry');
    setPhase('scene-entry');
    void (sentenceAudioRef.current && playAudio(sentenceAudioRef.current, 100));
  };

  const handleRetryQuiz = () => {
    setViewPhase('scene-entry');
    setPhase('scene-entry');
    void (sentenceAudioRef.current && playAudio(sentenceAudioRef.current, 0));
  };

  const handleNextProblem = () => {
    if (isFetching) return;

    // searchパラメータがある場合のみURLをクリア
    if (searchQuery) {
      router.push(pathname);
    }

    const nextIndex = currentIndex + 1;
    const nextProblemData = problemQueue[nextIndex];

    if (!nextProblemData) {
      // キューが空の場合はローディング状態にする
      console.error('[ProblemFlow] 問題キューが空です');
      setPhase('landing');
      setError('次の問題がありません');
      return;
    }

    const { options: newOptions, correctIndex: newCorrectIndex } = shuffleOptions(nextProblemData);
    setCurrentIndex(nextIndex);
    setProblem(nextProblemData);
    setOptions(newOptions);
    setCorrectIndex(newCorrectIndex);
    setSelectedOption(null);
    setPhase('scene-entry');
    setViewPhase('scene-entry');

    // 切り替え直後に英語音声を再生
    void (sentenceAudioRef.current && playAudio(sentenceAudioRef.current, 100));
  };

  return (
    <>
      {phase === 'landing' && (
        <StartButton error={error} handleStart={handleStart}>
          英語学習を始める
        </StartButton>
      )}
      {sceneImage && (
        <section
          className={`grid place-items-center ${settingsRef.current.isImageHiddenMode ? 'hidden' : ''}`}
        >
          <figure className="flex w-full justify-center">
            <Image
              src={sceneImage}
              alt="英語と日本語のセリフを並べた2コマシーン"
              width={500}
              height={750}
              className={`h-auto w-full max-w-[500px] object-contain ${
                phase === 'scene-entry' || phase === 'scene-ready' ? 'block' : 'hidden'
              }`}
              priority
              unoptimized
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
        <section className="grid gap-8">
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
                    setSelectedOption(index);
                    setViewPhase(isCorrect ? 'correct' : 'incorrect');
                    setPhase(isCorrect ? 'correct' : 'incorrect');
                    if (!isCorrect) return;

                    // 正解だったらクリック時に再生
                    void (sentenceAudioRef.current && playAudio(sentenceAudioRef.current, 0));
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
              onClick={() => playAudio(sentenceAudioRef.current, 0)}
              className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:opacity-60"
              disabled={!problem.audioEnUrl || isAudioBusy}
            >
              もう一度聞く
            </button>
          </div>
        </section>
      )}

      {(phase === 'correct' || phase === 'incorrect') && (
        <section className="grid gap-6 text-center">
          <div
            className={`rounded-3xl border px-6 py-10 shadow-lg shadow-slate-900/10 ${
              isCorrect
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            <h2 className="text-2xl font-bold">
              {isCorrect ? 'やった！ 正解です 🎉' : '残念…もう一度挑戦してみましょう'}
            </h2>
            {isCorrect && (
              <>
                <p className="mt-4 text-2xl font-semibold text-[#2a2b3c]">
                  {problem.englishSentence}
                </p>
                <p className="mt-4 text-lg  text-[#2a2b3c]">{problem.japaneseSentence}</p>
              </>
            )}
          </div>
          <div className="flex flex-row gap-3 items-center justify-center">
            {!isCorrect && (
              <button
                type="button"
                onClick={handleRetryQuiz}
                className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:opacity-60"
                disabled={isAudioBusy}
              >
                再挑戦
              </button>
            )}
            {isCorrect && (
              <button
                type="button"
                onClick={handleNextProblem}
                className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 transition enabled:hover:bg-[#c3684f] disabled:opacity-60"
                disabled={isFetching || isAudioBusy}
              >
                {isFetching ? '生成中…' : '次の問題へ'}
              </button>
            )}
          </div>
        </section>
      )}

      <audio
        ref={sentenceAudioRef}
        src={problem.audioEnUrl}
        preload="auto"
        onEnded={() => {
          if (viewPhase === 'quiz') {
            // クイズ英文が終わったら idle → 回答可能
            setAudioStatus('idle');
            return;
          }
          if (viewPhase === 'correct' || viewPhase === 'incorrect') {
            // 正解画面の英文が終わったら idle → 次の問題へ進める
            setAudioStatus('idle');
            return;
          }
          if (viewPhase === 'scene-entry' || viewPhase === 'scene-ready') {
            void (replyAudioRef.current && playAudio(replyAudioRef.current, 100));
          }
        }}
      />
      <audio
        ref={replyAudioRef}
        src={settingsRef.current.isEnglishMode ? problem.audioEnReplyUrl : problem.audioJaUrl}
        preload="auto"
        onEnded={() => {
          // 応答終了後はクイズへ遷移し、すぐに英文を再生
          if (viewPhase === 'scene-entry' || viewPhase === 'scene-ready') {
            setTimeout(() => {
              setViewPhase('quiz');
              setPhase('quiz');
              void (sentenceAudioRef.current && playAudio(sentenceAudioRef.current, 0));
            }, 200);
          }
        }}
      />
      {/* キャッシュを用意するために次の問題の音声と画像を読み込む */}
      {nextProblem && (
        <>
          <audio src={nextProblem.audioEnUrl} preload="auto" />
          <audio src={nextProblem.audioJaUrl} preload="auto" />
          <audio src={nextProblem.audioEnReplyUrl} preload="auto" />
        </>
      )}
      {nextSceneImage && (
        <Image
          unoptimized
          priority
          src={nextSceneImage}
          className="hidden"
          width={500}
          height={750}
          alt="英語と日本語のセリフを並べた2コマシーン"
        />
      )}
    </>
  );
}
