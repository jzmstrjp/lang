'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Problem } from '@prisma/client';
import LoadingSpinner from '../ui/loading-spinner';

type Phase = 'landing' | 'loading' | 'scene-entry' | 'scene-ready' | 'quiz' | 'result';

export type ProblemLength = 'short' | 'medium' | 'long';

type ProblemFlowProps = {
  length: ProblemLength;
};

// Prismaで自動生成された型を拡張して、incorrectOptionsを型安全にする
type ProblemData = Omit<Problem, 'incorrectOptions'> & {
  incorrectOptions: string[];
};

type AssetsData = {
  image: string | null;
  imagePrompt?: string;
  audio: {
    english?: string;
    japanese?: string;
    englishReply?: string;
  };
};

type ApiAssets = {
  imageUrl?: string;
  imagePrompt?: string;
  audio?: {
    english?: string;
    japanese?: string;
    englishReply?: string;
  };
};

type ApiResponse = {
  problem: ProblemData;
  assets: ApiAssets;
};

// ProblemType enum が削除されたため、直接文字列を使用

export default function ProblemFlow({ length }: ProblemFlowProps) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() ?? '';
  const router = useRouter();
  const pathname = usePathname();
  type AudioStatus = 'idle' | 'queued' | 'playing';

  type FetchPhase = 'idle' | 'bootstrapping' | 'loading' | 'prefetch';

  const [phase, setPhase] = useState<Phase>('landing');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [assets, setAssets] = useState<AssetsData | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [nextProblem, setNextProblem] = useState<ProblemData | null>(null);
  const [nextAssets, setNextAssets] = useState<AssetsData | null>(null);
  const [fetchPhase, setFetchPhase] = useState<FetchPhase>('idle');
  const [fetchingStatus, setFetchingStatus] = useState<'retrieving' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');

  const isFetching = fetchPhase === 'bootstrapping' || fetchPhase === 'loading';
  const isAudioBusy = audioStatus !== 'idle';

  const sceneImage = assets?.image ?? null;
  const shuffledOptions = options;

  const shuffleOptions = useCallback((target: ProblemData) => {
    const allOptions = [target.japaneseSentence, ...target.incorrectOptions];
    const zipped = allOptions.map((option, index) => ({ option, index }));

    for (let i = zipped.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
    }

    const choices = zipped.map((item) => item.option);
    const correct = zipped.findIndex((item) => item.index === 0);

    return { options: choices, correctIndex: correct === -1 ? 0 : correct };
  }, []);

  type FetchSuccessPayload = {
    problem: ProblemData;
    assets: AssetsData;
    options: string[];
    correctIndex: number;
  };

  const buildPayloadFromResponse = useCallback(
    (data: ApiResponse): FetchSuccessPayload => {
      const assetsData: AssetsData = {
        image: data.assets?.imageUrl ?? null,
        imagePrompt: data.assets?.imagePrompt,
        audio: {
          english: data.assets?.audio?.english,
          japanese: data.assets?.audio?.japanese,
          englishReply: data.assets?.audio?.englishReply,
        },
      };

      const { options, correctIndex: newCorrectIndex } = shuffleOptions(data.problem);

      return {
        problem: data.problem,
        assets: assetsData,
        options,
        correctIndex: newCorrectIndex,
      };
    },
    [shuffleOptions],
  );

  const sentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const replyAudioRef = useRef<HTMLAudioElement | null>(null);

  const [viewPhase, setViewPhase] = useState<Phase>('landing');
  const [viewReady, setViewReady] = useState(false);
  const isMountedRef = useRef(false);
  const isPrefetchingNextRef = useRef(false);
  const isFirstQuiz = useRef(true);
  const [mounted, setMounted] = useState(false);

  const settingsRef = useRef({
    isEnglishMode: true,
    // 初期レンダリングで画像を表示可能にして onLoad を確実に発火させる
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

  // 音声再生の制御関数
  const playSentenceAudio = useCallback(() => {
    if (!sentenceAudioRef.current) return;
    setAudioStatus('playing'); // 待機中も無効化
    setTimeout(() => {
      sentenceAudioRef.current!.currentTime = 0;
      sentenceAudioRef.current!.play().catch(() => {
        console.warn('英語音声の再生に失敗しました。');
        setAudioStatus('idle');
      });
    }, 500);
  }, []);

  // 次の問題を事前フェッチする関数
  const prefetchNextProblem = useCallback(async () => {
    if (isPrefetchingNextRef.current) return;

    isPrefetchingNextRef.current = true;
    try {
      const params = new URLSearchParams({ type: length });
      const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiResponse = await response.json();
        const payload = buildPayloadFromResponse(data);
        setNextProblem(payload.problem);
        setNextAssets(payload.assets);
        console.log('[ProblemFlow] 次の問題の事前フェッチ完了:', data.problem.englishSentence);
      }
    } catch (err) {
      console.warn('[ProblemFlow] 次の問題の事前フェッチ失敗:', err);
    } finally {
      isPrefetchingNextRef.current = false;
    }
  }, [buildPayloadFromResponse, length]);

  const fetchProblem = useCallback(async () => {
    setFetchPhase('loading');
    setFetchingStatus('retrieving');

    try {
      const params = new URLSearchParams({ type: length });
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('問題がありません');
      }

      const data: ApiResponse = await response.json();
      const payload = buildPayloadFromResponse(data);

      if (isMountedRef.current) {
        setProblem(payload.problem);
        setAssets(payload.assets);
        setOptions(payload.options);
        setCorrectIndex(payload.correctIndex);
        setSelectedOption(null);
        setPhase('scene-entry');
        setFetchPhase('idle');
        setFetchingStatus(null);
        setViewReady(true);
        console.log('[ProblemFlow] 新しい問題取得完了:', data.problem.englishSentence);
      }
    } catch (err) {
      console.error('[ProblemFlow] 問題取得失敗:', err);
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : '問題取得に失敗しました';
        setError(message);
        setPhase('landing');
        setFetchPhase('idle');
        setFetchingStatus(null);
      }
    }
  }, [buildPayloadFromResponse, length, searchQuery]);

  // phaseごとの処理
  useEffect(() => {
    isMountedRef.current = true;

    // --- phaseごとの副作用をここに統合 ---
    switch (phase) {
      case 'landing':
        // マウント完了フラグを立てる
        if (!mounted) setMounted(true);
        break;
      case 'loading':
        void fetchProblem();
        break;

      case 'scene-entry':
        loadSettings();
        const shouldSkipImage = !sceneImage || settingsRef.current.isImageHiddenMode;
        if (shouldSkipImage) {
          setPhase('scene-ready');
        }
        // else の場合は何もしない（画像の onLoad で scene-ready に遷移させる）
        break;

      case 'scene-ready':
        // scene-ready では即時再生は行わない（iOSで二重再生になるため）
        // 音声はユーザー操作後または <audio> の onEnded からのみ制御する
        break;

      case 'quiz':
        break;

      case 'result':
        if (!isCorrect && !nextProblem && !isPrefetchingNextRef.current) {
          void prefetchNextProblem();
        }
        break;
    }

    // prefetch（quiz進行中）
    if (problem && !nextProblem && !isPrefetchingNextRef.current) {
      void prefetchNextProblem();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [
    phase,
    sceneImage,
    isCorrect,
    problem,
    nextProblem,
    prefetchNextProblem,
    fetchProblem,
    mounted,
  ]);

  // 初回のみbootstrapを実行
  if (isFirstQuiz.current) {
    isFirstQuiz.current = false;

    // ← 初回だけRESETを実行
    setPhase('landing');
    setProblem(null);
    setAssets(null);
    setOptions([]);
    setCorrectIndex(0);
    setSelectedOption(null);
    setNextProblem(null);
    setNextAssets(null);
    setFetchPhase('idle');
    setFetchingStatus(null);
    setError(null);
    setAudioStatus('idle');
    isPrefetchingNextRef.current = false;

    const bootstrap = async () => {
      setFetchPhase('bootstrapping');
      setFetchingStatus('retrieving');

      try {
        const params = new URLSearchParams({ type: length });
        if (searchQuery) {
          params.set('search', searchQuery);
        }
        const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('問題がありません');
        }

        const data: ApiResponse = await response.json();
        const payload = buildPayloadFromResponse(data);

        setProblem(payload.problem);
        setAssets(payload.assets);
        setOptions(payload.options);
        setCorrectIndex(payload.correctIndex);
        setSelectedOption(null);
        setFetchPhase('idle');
        setFetchingStatus(null);
        setViewReady(true);
        console.log('[ProblemFlow] 事前フェッチ完了:', data.problem.englishSentence);
      } catch (err) {
        console.error('[ProblemFlow] 事前フェッチ失敗:', err);
        const message = err instanceof Error ? err.message : '問題取得に失敗しました';
        setError(message);
        setPhase('landing');
        setFetchPhase('idle');
        setFetchingStatus(null);
      }
    };

    void bootstrap();
  }

  const handleStart = () => {
    if (!viewReady || !problem || !assets) return;
    setViewPhase('scene-entry');
    setPhase('scene-entry');
    if (assets.audio?.english && sentenceAudioRef.current) {
      setAudioStatus('playing'); // 再生開始時に設定
      setTimeout(() => {
        sentenceAudioRef.current!.pause();
        sentenceAudioRef.current!.currentTime = 0;
        sentenceAudioRef.current!.play().catch((err) => {
          console.warn('play error', err);
          setAudioStatus('idle');
        });
      }, 500);
    }
  };

  const handleRetryQuiz = () => {
    if (!problem || !assets) return;
    setViewPhase('scene-entry');
    setPhase('scene-entry');
    if (assets.audio?.english && sentenceAudioRef.current) {
      setAudioStatus('playing');
      setTimeout(() => {
        sentenceAudioRef.current!.pause();
        sentenceAudioRef.current!.currentTime = 0;
        sentenceAudioRef.current!.play().catch((err) => {
          console.warn('play error', err);
          setAudioStatus('idle');
        });
      }, 500);
    }
  };

  const handleNextProblem = () => {
    if (isFetching) return;

    router.push(pathname);

    // 次の問題が事前フェッチ済みの場合は即座に切り替え
    if (nextProblem && nextAssets) {
      const { options: newOptions, correctIndex: newCorrectIndex } = shuffleOptions(nextProblem);
      setProblem(nextProblem);
      setAssets(nextAssets);
      setOptions(newOptions);
      setCorrectIndex(newCorrectIndex);
      setSelectedOption(null);
      setPhase('scene-entry');
      setViewPhase('scene-entry');
      setNextProblem(null);
      setNextAssets(null);

      // 切り替え直後に英語音声を再生
      if (nextAssets.audio?.english && sentenceAudioRef.current) {
        setAudioStatus('playing');
        setTimeout(() => {
          sentenceAudioRef.current!.pause();
          sentenceAudioRef.current!.currentTime = 0;
          sentenceAudioRef.current!.play().catch((err) => {
            console.warn('play error on next problem', err);
            setAudioStatus('idle');
          });
        }, 500);
      }
    } else {
      setPhase('loading');
      void fetchProblem();
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 font-sans text-[#2a2b3c] sm:px-6 lg:max-w-4xl">
      <h2>{isAudioBusy ? 'audioBusy' : 'audioIdle'}</h2>
      {phase === 'landing' && (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-lg font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:opacity-60"
            disabled={!mounted || !viewReady || !!error || isAudioBusy}
          >
            {isFetching && '問題を準備中…'}
            {!isFetching && !viewReady && !error && '準備中…'}
            {!isFetching && viewReady && '英語学習を始める'}
            {error && 'エラーが発生しました'}
          </button>
          {viewReady && !error && <p className="text-base text-[#666] mt-2">※音が出ます</p>}
        </div>
      )}

      {phase === 'loading' && (
        <LoadingSpinner label={fetchingStatus === 'retrieving' ? '問題を取得中...' : '処理中...'} />
      )}

      {sceneImage && !settingsRef.current.isImageHiddenMode && (
        <section className="grid place-items-center">
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
              onLoadingComplete={() => {
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
      {problem &&
        (phase === 'scene-entry' || phase === 'scene-ready') &&
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
                    setSelectedOption(index);
                    setViewPhase('result');
                    setPhase('result');

                    // 正解だったらクリック時に再生
                    if (
                      index === correctIndex &&
                      assets?.audio?.english &&
                      sentenceAudioRef.current
                    ) {
                      setAudioStatus('queued'); // ★ 正解画面では busy にする
                      setTimeout(() => {
                        sentenceAudioRef.current!.pause();
                        sentenceAudioRef.current!.currentTime = 0;
                        sentenceAudioRef
                          .current!.play()
                          .then(() => setAudioStatus('playing'))
                          .catch((err) => {
                            console.warn('play error on correct answer', err);
                            setAudioStatus('idle');
                          });
                      }, 500);
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
              onClick={playSentenceAudio}
              className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:opacity-60"
              disabled={!assets?.audio?.english || isAudioBusy}
            >
              もう一度聞く
            </button>
          </div>
        </section>
      )}

      {phase === 'result' && problem && (
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

      {/* 音声タグ */}
      {assets?.audio?.english && (
        <audio
          ref={sentenceAudioRef}
          src={assets.audio.english}
          preload="auto"
          onEnded={() => {
            if (viewPhase === 'quiz') {
              // クイズ英文が終わったら idle → 回答可能
              setAudioStatus('idle');
              return;
            }
            if (viewPhase === 'result') {
              // 正解画面の英文が終わったら idle → 次の問題へ進める
              setAudioStatus('idle');
              return;
            }
            setTimeout(() => {
              if (viewPhase === 'scene-entry' || viewPhase === 'scene-ready') {
                const replySrc = settingsRef.current.isEnglishMode
                  ? assets?.audio?.englishReply
                  : assets?.audio?.japanese;
                if (replySrc && replyAudioRef.current) {
                  replyAudioRef.current.src = replySrc;
                  setAudioStatus('playing'); // ★ 再生開始時にbusyへ
                  replyAudioRef.current.play().catch(() => {
                    setAudioStatus('idle');
                    setViewPhase('quiz');
                  });
                } else {
                  setViewPhase('quiz');
                }
              }
            }, 500);
          }}
        />
      )}

      <audio
        ref={replyAudioRef}
        preload="auto"
        onEnded={() => {
          // 応答終了後はクイズへ遷移し、すぐに英文を再生
          if (viewPhase === 'scene-entry' || viewPhase === 'scene-ready') {
            setViewPhase('quiz');
            setPhase('quiz');
            if (sentenceAudioRef.current) {
              // ★ この時点で busy に戻す（待ち時間中に idle にならないようにする）
              setAudioStatus('queued');
              setTimeout(() => {
                sentenceAudioRef.current!.pause();
                sentenceAudioRef.current!.currentTime = 0;
                sentenceAudioRef
                  .current!.play()
                  .then(() => setAudioStatus('playing'))
                  .catch(() => setAudioStatus('idle'));
              }, 500);
            } else {
              setAudioStatus('idle');
            }
          }
        }}
      />
    </main>
  );
}
