'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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

  type FlowState = {
    phase: Phase;
    problem: ProblemData | null;
    assets: AssetsData | null;
    options: string[];
    correctIndex: number;
    selectedOption: number | null;
    nextProblem: ProblemData | null;
    nextAssets: AssetsData | null;
    fetchPhase: FetchPhase;
    fetchingStatus: 'retrieving' | null;
    error: string | null;
    isReady: boolean;
    imageLoaded: boolean;
    audioStatus: AudioStatus;
  };

  type FetchSuccessPayload = {
    problem: ProblemData;
    assets: AssetsData;
    options: string[];
    correctIndex: number;
  };

  type FlowAction =
    | { type: 'RESET' }
    | { type: 'START_PROBLEM' }
    | { type: 'RETRY_PROBLEM'; payload: { options: string[]; correctIndex: number } }
    | { type: 'SELECT_OPTION'; payload: number }
    | { type: 'FETCH_START'; payload: { phase: FetchPhase; status: 'retrieving' | null } }
    | { type: 'FETCH_SUCCESS'; payload: { phase: FetchPhase } & FetchSuccessPayload }
    | { type: 'FETCH_FAILURE'; payload: { phase: FetchPhase; message: string } }
    | { type: 'SET_PHASE'; payload: Phase }
    | { type: 'SET_OPTIONS'; payload: { options: string[]; correctIndex: number } }
    | { type: 'SET_IMAGE_LOADED'; payload: boolean }
    | { type: 'SET_AUDIO_STATUS'; payload: AudioStatus }
    | { type: 'LOAD_PROBLEM'; payload: FetchSuccessPayload & { clearNext?: boolean } }
    | { type: 'ENTER_SCENE'; payload: { hasImage: boolean; hiddenMode: boolean } };

  const initialState: FlowState = {
    phase: 'landing',
    problem: null,
    assets: null,
    options: [],
    correctIndex: 0,
    selectedOption: null,
    nextProblem: null,
    nextAssets: null,
    fetchPhase: 'idle',
    fetchingStatus: null,
    error: null,
    isReady: false,
    imageLoaded: false,
    audioStatus: 'idle',
  };

  function flowReducer(state: FlowState, action: FlowAction): FlowState {
    switch (action.type) {
      case 'RESET':
        return initialState;
      case 'START_PROBLEM':
        return {
          ...state,
          selectedOption: null,
          phase: 'scene-entry',
        };
      case 'RETRY_PROBLEM':
        return {
          ...state,
          selectedOption: null,
          options: action.payload.options,
          correctIndex: action.payload.correctIndex,
          phase: 'scene-entry',
        };
      case 'SELECT_OPTION':
        return {
          ...state,
          selectedOption: action.payload,
          phase: 'result',
        };
      case 'FETCH_START':
        return {
          ...state,
          fetchPhase: action.payload.phase,
          fetchingStatus: action.payload.status,
          error: action.payload.phase === 'prefetch' ? state.error : null,
        };
      case 'FETCH_SUCCESS':
        if (action.payload.phase === 'prefetch') {
          return {
            ...state,
            fetchPhase: 'idle',
            fetchingStatus: null,
            nextProblem: action.payload.problem,
            nextAssets: action.payload.assets,
          };
        }
        return {
          ...state,
          fetchPhase: 'idle',
          fetchingStatus: null,
          problem: action.payload.problem,
          assets: action.payload.assets,
          options: action.payload.options,
          correctIndex: action.payload.correctIndex,
          selectedOption: null,
          nextProblem:
            action.payload.phase === 'bootstrapping' ? state.nextProblem : state.nextProblem,
          nextAssets:
            action.payload.phase === 'bootstrapping' ? state.nextAssets : state.nextAssets,
          isReady: true,
          phase: action.payload.phase === 'loading' ? 'scene-entry' : state.phase,
          imageLoaded: false,
        };
      case 'FETCH_FAILURE':
        if (action.payload.phase === 'prefetch') {
          return {
            ...state,
            fetchPhase: 'idle',
            fetchingStatus: null,
          };
        }
        return {
          ...state,
          fetchPhase: 'idle',
          fetchingStatus: null,
          error: action.payload.message,
          phase: action.payload.phase === 'loading' ? 'landing' : state.phase,
        };
      case 'SET_PHASE':
        return {
          ...state,
          phase: action.payload,
          imageLoaded: action.payload === 'scene-entry' ? false : state.imageLoaded,
        };
      case 'SET_OPTIONS':
        return {
          ...state,
          options: action.payload.options,
          correctIndex: action.payload.correctIndex,
        };
      case 'SET_IMAGE_LOADED':
        return {
          ...state,
          imageLoaded: action.payload,
        };
      case 'SET_AUDIO_STATUS':
        return {
          ...state,
          audioStatus: action.payload,
        };
      case 'ENTER_SCENE': {
        const shouldSkipImage = !action.payload.hasImage || action.payload.hiddenMode;
        if (shouldSkipImage) {
          // 画像なし or 非表示モード → 即 scene-ready
          return {
            ...state,
            phase: 'scene-ready',
            imageLoaded: true,
          };
        }
        // 画像あり → 必ず scene-entry で止めて onLoad 待ち
        return {
          ...state,
          phase: 'scene-entry',
          imageLoaded: false,
        };
      }
      case 'LOAD_PROBLEM':
        return {
          ...state,
          problem: action.payload.problem,
          assets: action.payload.assets,
          options: action.payload.options,
          correctIndex: action.payload.correctIndex,
          selectedOption: null,
          phase: 'scene-entry',
          imageLoaded: false,
          isReady: true,
          nextProblem: action.payload.clearNext ? null : state.nextProblem,
          nextAssets: action.payload.clearNext ? null : state.nextAssets,
        };
      default:
        return state;
    }
  }

  const [state, dispatch] = useReducer(flowReducer, initialState);

  const {
    phase,
    problem,
    assets,
    options: shuffledOptions,
    correctIndex,
    selectedOption,
    nextProblem,
    nextAssets,
    fetchPhase,
    fetchingStatus,
    error,
    isReady,
    audioStatus,
  } = state;

  const isFetching = fetchPhase === 'bootstrapping' || fetchPhase === 'loading';
  const isAudioBusy = audioStatus !== 'idle';

  const sceneImage = assets?.image ?? null;

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
  const playbackTimeoutRef = useRef<number | null>(null);
  const secondaryPlaybackTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
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

    dispatch({ type: 'SET_AUDIO_STATUS', payload: 'queued' });
    sentenceAudioRef.current.currentTime = 0;
    sentenceAudioRef.current.play().catch(() => {
      console.warn('英語音声の再生に失敗しました。');
      dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
    });
  }, [dispatch]);

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
        dispatch({ type: 'FETCH_SUCCESS', payload: { phase: 'prefetch', ...payload } });
        console.log('[ProblemFlow] 次の問題の事前フェッチ完了:', data.problem.englishSentence);
      }
    } catch (err) {
      console.warn('[ProblemFlow] 次の問題の事前フェッチ失敗:', err);
      const message = err instanceof Error ? err.message : '次の問題の取得に失敗しました';
      dispatch({ type: 'FETCH_FAILURE', payload: { phase: 'prefetch', message } });
    } finally {
      isPrefetchingNextRef.current = false;
    }
  }, [buildPayloadFromResponse, dispatch, length]);

  const fetchProblem = useCallback(async () => {
    dispatch({ type: 'FETCH_START', payload: { phase: 'loading', status: 'retrieving' } });

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
        dispatch({ type: 'FETCH_SUCCESS', payload: { phase: 'loading', ...payload } });
        console.log('[ProblemFlow] 新しい問題取得完了:', data.problem.englishSentence);
      }
    } catch (err) {
      console.error('[ProblemFlow] 問題取得失敗:', err);
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : '問題取得に失敗しました';
        dispatch({ type: 'FETCH_FAILURE', payload: { phase: 'loading', message } });
      }
    }
  }, [buildPayloadFromResponse, dispatch, length, searchQuery]);

  const clearAll = (timeoutId: number | null) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
    }
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    if (secondaryPlaybackTimeoutRef.current) {
      clearTimeout(secondaryPlaybackTimeoutRef.current);
      secondaryPlaybackTimeoutRef.current = null;
    }
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  };

  // phaseごとの処理
  useEffect(() => {
    isMountedRef.current = true;
    const sentenceAudio = sentenceAudioRef.current;
    const replyAudio = replyAudioRef.current;

    let timeoutId: number | null = null;

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
        dispatch({
          type: 'ENTER_SCENE',
          payload: { hasImage: !!sceneImage, hiddenMode: settingsRef.current.isImageHiddenMode },
        });
        break;

      case 'scene-ready':
        // scene-ready に入った時点で英語音声を一度だけ再生
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'queued' });
        timeoutId = window.setTimeout(() => {
          playSentenceAudio();
        }, 500);
        break;

      case 'quiz':
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'queued' });
        timeoutId = window.setTimeout(() => {
          playSentenceAudio();
        }, 1000);
        break;

      case 'result':
        if (isCorrect) {
          dispatch({ type: 'SET_AUDIO_STATUS', payload: 'queued' });
          timeoutId = window.setTimeout(() => {
            playSentenceAudio();
          }, 1000);
        } else if (!nextProblem && !isPrefetchingNextRef.current) {
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
      sentenceAudio?.pause();
      replyAudio?.pause();
      clearAll(timeoutId);
    };
  }, [
    phase,
    sceneImage,
    isCorrect,
    problem,
    nextProblem,
    playSentenceAudio,
    prefetchNextProblem,
    fetchProblem,
    dispatch,
    mounted,
  ]);

  // 初回のみbootstrapを実行
  if (isFirstQuiz.current) {
    isFirstQuiz.current = false;

    // ← 初回だけRESETを実行
    dispatch({ type: 'RESET' });
    isPrefetchingNextRef.current = false;

    const bootstrap = async () => {
      dispatch({ type: 'FETCH_START', payload: { phase: 'bootstrapping', status: 'retrieving' } });

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

        dispatch({ type: 'FETCH_SUCCESS', payload: { phase: 'bootstrapping', ...payload } });
        console.log('[ProblemFlow] 事前フェッチ完了:', data.problem.englishSentence);
      } catch (err) {
        console.error('[ProblemFlow] 事前フェッチ失敗:', err);
        const message = err instanceof Error ? err.message : '問題取得に失敗しました';
        dispatch({ type: 'FETCH_FAILURE', payload: { phase: 'bootstrapping', message } });
      }
    };

    void bootstrap();
  }

  const handleStart = () => {
    if (!isReady || !problem || !assets) return;

    // 初回のみユーザー操作で「再生許可」を得る（すぐ止める）
    if (isFirstQuiz.current && assets.audio.english && sentenceAudioRef.current) {
      sentenceAudioRef.current
        .play()
        .then(() => {
          if (sentenceAudioRef.current) {
            sentenceAudioRef.current.pause();
            sentenceAudioRef.current.currentTime = 0;
          }
        })
        .catch(() => {
          console.warn('初回の再生許可取得に失敗しました');
        });
    }

    // シーン開始に遷移
    dispatch({ type: 'START_PROBLEM' });
  };

  const handleRetryQuiz = () => {
    if (!problem) return;

    const { options, correctIndex: newCorrectIndex } = shuffleOptions(problem);
    dispatch({ type: 'RETRY_PROBLEM', payload: { options, correctIndex: newCorrectIndex } });
  };

  const handleNextProblem = () => {
    if (isFetching) return;

    router.push(pathname);

    // 次の問題が事前フェッチ済みの場合は即座に切り替え
    if (nextProblem && nextAssets) {
      // 次の問題の選択肢をシャッフル
      const { options, correctIndex: newCorrectIndex } = shuffleOptions(nextProblem);
      dispatch({
        type: 'LOAD_PROBLEM',
        payload: {
          problem: nextProblem,
          assets: nextAssets,
          options,
          correctIndex: newCorrectIndex,
          clearNext: true,
        },
      });
    } else {
      // 事前フェッチされていない場合は従来通り
      dispatch({ type: 'SET_PHASE', payload: 'loading' });
      void fetchProblem();
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 font-sans text-[#2a2b3c] sm:px-6 lg:max-w-4xl">
      {phase === 'landing' && (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-lg font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!mounted || !isReady || !!error || isAudioBusy}
          >
            {isFetching && '問題を準備中…'}
            {!isFetching && !isReady && !error && '準備中…'}
            {!isFetching && isReady && '英語学習を始める'}
            {error && 'エラーが発生しました'}
          </button>
          {isReady && !error && <p className="text-base text-[#666] mt-2">※音が出ます</p>}
        </div>
      )}

      {phase === 'loading' && (
        <LoadingSpinner label={fetchingStatus === 'retrieving' ? '問題を取得中...' : '処理中...'} />
      )}

      {(phase === 'scene-entry' || phase === 'scene-ready') && (
        <section className="grid place-items-center">
          <figure className="flex w-full justify-center">
            {sceneImage && !settingsRef.current.isImageHiddenMode ? (
              <Image
                src={sceneImage}
                alt="英語と日本語のセリフを並べた2コマシーン"
                width={500}
                height={750}
                className="h-auto w-full max-w-[500px] object-contain"
                priority
                unoptimized={Boolean(sceneImage)}
                onLoad={() => {
                  dispatch({ type: 'SET_PHASE', payload: 'scene-ready' });
                }}
              />
            ) : problem ? (
              <div className="w-full max-w-[500px] p-6 text-center text-[#2a2b3c] leading-relaxed bg-white rounded-lg border border-[#d8cbb6]">
                <h3 className="font-semibold mb-3 text-lg text-[#2f8f9d]">シーン</h3>
                <p className="font-bold text-2xl">{problem.place}</p>
              </div>
            ) : (
              <div className="w-full max-w-[500px] p-8 text-center bg-white rounded-lg border border-[#d8cbb6]">
                <p className="text-[#666] text-lg">画像なし</p>
              </div>
            )}
          </figure>
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
                    dispatch({ type: 'SELECT_OPTION', payload: index });
                  }}
                  className="w-full rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-left text-base font-medium text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#2f8f9d] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d] disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:cursor-not-allowed disabled:opacity-60"
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
                className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAudioBusy}
              >
                再挑戦
              </button>
            )}
            {isCorrect && (
              <button
                type="button"
                onClick={handleNextProblem}
                className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 transition enabled:hover:bg-[#c3684f] disabled:cursor-not-allowed disabled:opacity-60"
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
          onPlay={() => dispatch({ type: 'SET_AUDIO_STATUS', payload: 'playing' })}
          onPause={() => dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' })}
          onEnded={() => {
            // scene-readyフェーズの時のみ返答音声を再生
            if (phase === 'scene-ready') {
              const replySrc = settingsRef.current.isEnglishMode
                ? assets?.audio?.englishReply
                : assets?.audio?.japanese;
              if (replySrc && replyAudioRef.current) {
                replyAudioRef.current.src = replySrc;
                replyAudioRef.current.play().catch(() => {
                  console.warn('返答音声の再生に失敗しました。');
                });
              } else {
                // 返答音声がない場合はクイズに移行
                dispatch({ type: 'SET_PHASE', payload: 'quiz' });
              }
            } else {
              // 他のフェーズでは音声終了時にidleに戻す
              dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
            }
          }}
        />
      )}

      <audio
        ref={replyAudioRef}
        preload="auto"
        onPlay={() => dispatch({ type: 'SET_AUDIO_STATUS', payload: 'playing' })}
        onPause={() => dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' })}
        onEnded={() => {
          if (phase === 'scene-ready') {
            dispatch({ type: 'SET_PHASE', payload: 'quiz' });
          } else {
            // 他のフェーズでは音声終了時にidleに戻す
            dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
          }
        }}
      />
    </main>
  );
}
