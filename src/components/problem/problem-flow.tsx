'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Problem } from '@prisma/client';
import LoadingSpinner from '../ui/loading-spinner';

type Phase = 'landing' | 'loading' | 'scene' | 'quiz' | 'result';

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
    isEnglishMode: boolean;
    isImageHiddenMode: boolean;
  };

  type FetchSuccessPayload = {
    problem: ProblemData;
    assets: AssetsData;
    options: string[];
    correctIndex: number;
  };

  type FlowAction =
    | { type: 'RESET' }
    | { type: 'SET_SETTINGS'; payload: { isEnglishMode: boolean; isImageHiddenMode: boolean } }
    | { type: 'FETCH_START'; payload: { phase: FetchPhase; status: 'retrieving' | null } }
    | { type: 'FETCH_SUCCESS'; payload: { phase: FetchPhase } & FetchSuccessPayload }
    | { type: 'FETCH_FAILURE'; payload: { phase: FetchPhase; message: string } }
    | { type: 'SET_PHASE'; payload: Phase }
    | { type: 'SET_OPTIONS'; payload: { options: string[]; correctIndex: number } }
    | { type: 'SET_SELECTED_OPTION'; payload: number | null }
    | { type: 'SET_IMAGE_LOADED'; payload: boolean }
    | { type: 'SET_AUDIO_STATUS'; payload: AudioStatus }
    | { type: 'LOAD_PROBLEM'; payload: FetchSuccessPayload & { clearNext?: boolean } };

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
    isEnglishMode: false,
    isImageHiddenMode: false,
  };

  function flowReducer(state: FlowState, action: FlowAction): FlowState {
    switch (action.type) {
      case 'RESET':
        return {
          ...initialState,
          isEnglishMode: state.isEnglishMode,
          isImageHiddenMode: state.isImageHiddenMode,
        };
      case 'SET_SETTINGS':
        return {
          ...state,
          isEnglishMode: action.payload.isEnglishMode,
          isImageHiddenMode: action.payload.isImageHiddenMode,
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
          phase: action.payload.phase === 'loading' ? 'scene' : state.phase,
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
          imageLoaded: action.payload === 'scene' ? false : state.imageLoaded,
        };
      case 'SET_OPTIONS':
        return {
          ...state,
          options: action.payload.options,
          correctIndex: action.payload.correctIndex,
        };
      case 'SET_SELECTED_OPTION':
        return {
          ...state,
          selectedOption: action.payload,
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
      case 'LOAD_PROBLEM':
        return {
          ...state,
          problem: action.payload.problem,
          assets: action.payload.assets,
          options: action.payload.options,
          correctIndex: action.payload.correctIndex,
          selectedOption: null,
          phase: 'scene',
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
    imageLoaded,
    audioStatus,
    isEnglishMode,
    isImageHiddenMode,
  } = state;

  const isFetching = fetchPhase === 'bootstrapping' || fetchPhase === 'loading';
  const isAudioBusy = audioStatus !== 'idle';
  const isAudioActivelyPlaying = audioStatus === 'playing';

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

  const isEnglishModeRef = useRef(isEnglishMode);
  const isImageHiddenModeRef = useRef(isImageHiddenMode);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const secondaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  const secondaryPlaybackTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);
  const isPrefetchingNextRef = useRef(false);

  // 日本語音声なしの設定をlocalStorageから読み込み
  useEffect(() => {
    const loadModes = () => {
      const savedEnglishMode = localStorage.getItem('englishMode');
      const savedNoImageMode = localStorage.getItem('noImageMode');

      dispatch({
        type: 'SET_SETTINGS',
        payload: {
          isEnglishMode: savedEnglishMode === 'true',
          isImageHiddenMode: savedNoImageMode === 'true',
        },
      });
    };

    loadModes();

    // localStorageの変更を監視
    const handleStorageChange = () => {
      loadModes();
    };

    window.addEventListener('storage', handleStorageChange);

    // ページ内でのlocalStorage変更を検知するため、定期的にチェック
    const interval = setInterval(() => {
      loadModes();
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    isEnglishModeRef.current = isEnglishMode;
  }, [isEnglishMode]);

  useEffect(() => {
    isImageHiddenModeRef.current = isImageHiddenMode;
  }, [isImageHiddenMode]);

  // ProblemLength を直接使用
  // 正解判定：selectedOption が correctIndex と一致するか
  const isCorrect = useMemo(
    () => problem != null && selectedOption === correctIndex,
    [correctIndex, problem, selectedOption],
  );

  // 音声再生ロジックを共通化
  const startSceneAudioSequence = useCallback(
    (delay: number = 1000) => {
      if (!assets?.audio) return;

      const englishSrc = assets.audio.english;
      const japaneseSrc = assets.audio.japanese;
      const englishMode = isEnglishModeRef.current;

      let englishAudio: HTMLAudioElement | null = null;
      let japaneseAudio: HTMLAudioElement | null = null;

      const queueQuizTransition = () => {
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        if (isMountedRef.current) {
          dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
          dispatch({ type: 'SET_PHASE', payload: 'quiz' });
        }
      };

      const startJapanesePlayback = () => {
        const audioSrc = englishMode ? assets.audio.englishReply : japaneseSrc;
        if (japaneseAudio || !audioSrc) {
          queueQuizTransition();
          return;
        }

        const handleJapaneseEnded = () => {
          if (isMountedRef.current) queueQuizTransition();
        };

        japaneseAudio = new Audio(audioSrc);
        secondaryAudioRef.current = japaneseAudio;
        japaneseAudio.addEventListener('ended', handleJapaneseEnded);

        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'queued' });
        secondaryPlaybackTimeoutRef.current = window.setTimeout(() => {
          dispatch({ type: 'SET_AUDIO_STATUS', payload: 'playing' });
          japaneseAudio
            ?.play()
            .catch(() => {
              const audioType = englishMode ? '英語返答音声' : '日本語音声';
              console.warn(`${audioType}の自動再生に失敗しました。`);
              dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
              queueQuizTransition();
            })
            .finally(() => {
              secondaryPlaybackTimeoutRef.current = null;
            });
        }, 300);
      };

      const startEnglishPlayback = () => {
        if (!englishSrc) {
          startJapanesePlayback();
          return;
        }

        const handleEnglishEnded = () => {
          if (isMountedRef.current) {
            dispatch({ type: 'SET_AUDIO_STATUS', payload: 'queued' });
            startJapanesePlayback();
          }
        };

        englishAudio = new Audio(englishSrc);
        audioRef.current = englishAudio;
        englishAudio.addEventListener('ended', handleEnglishEnded);

        playbackTimeoutRef.current = window.setTimeout(() => {
          dispatch({ type: 'SET_AUDIO_STATUS', payload: 'playing' });
          englishAudio
            ?.play()
            .catch(() => {
              console.warn('英語音声の自動再生に失敗しました。');
              dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
              handleEnglishEnded();
            })
            .finally(() => {
              playbackTimeoutRef.current = null;
            });
        }, delay);
      };

      startEnglishPlayback();

      return () => {
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
        englishAudio?.pause();
        japaneseAudio?.pause();
        if (audioRef.current === englishAudio) audioRef.current = null;
        if (secondaryAudioRef.current === japaneseAudio) secondaryAudioRef.current = null;
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
      };
    },
    [assets, dispatch],
  );

  // 英語音声を再生する関数
  const playEnglishAudio = useCallback(() => {
    if (!assets?.audio?.english) return;

    // 既存の音声を停止
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(assets.audio.english);
    audioRef.current = audio;

    const handleEnded = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
    };

    const handleError = () => {
      console.warn('英語音声の再生に失敗しました。');
      dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    dispatch({ type: 'SET_AUDIO_STATUS', payload: 'playing' });
    audio.play().catch(() => {
      console.warn('英語音声の再生に失敗しました。');
      dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
    });

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
    };
  }, [assets?.audio?.english, dispatch]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      audioRef.current?.pause();
      audioRef.current = null;
      secondaryAudioRef.current?.pause();
      secondaryAudioRef.current = null;
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
  }, []);

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    secondaryAudioRef.current?.pause();
    secondaryAudioRef.current = null;

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

    const hasSceneAudio = Boolean(
      assets?.audio?.english || assets?.audio?.japanese || assets?.audio?.englishReply,
    );

    if (phase === 'scene') {
      dispatch({ type: 'SET_IMAGE_LOADED', payload: false });
    }

    if (phase === 'scene' || phase === 'quiz') {
      dispatch({ type: 'SET_AUDIO_STATUS', payload: hasSceneAudio ? 'queued' : 'idle' });
    } else if (phase === 'result' && isCorrect && assets?.audio?.english) {
      dispatch({ type: 'SET_AUDIO_STATUS', payload: 'queued' });
    } else {
      dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (phase === 'result') {
      const englishSrc = assets?.audio?.english;
      if (!isCorrect || !englishSrc) {
        return;
      }

      const audio = new Audio(englishSrc);
      audioRef.current = audio;

      const handleEnded = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
      };

      const handleError = () => {
        console.warn('正解音声の再生に失敗しました。');
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      playbackTimeoutRef.current = window.setTimeout(() => {
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'playing' });
        audio
          .play()
          .catch(() => {
            console.warn('正解音声の再生に失敗しました。');
            dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
          })
          .finally(() => {
            playbackTimeoutRef.current = null;
          });
      }, 1000);

      return () => {
        if (playbackTimeoutRef.current) {
          clearTimeout(playbackTimeoutRef.current);
          playbackTimeoutRef.current = null;
        }
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.pause();
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
      };
    }

    const hasSceneImage = Boolean(sceneImage) && !isImageHiddenModeRef.current;

    if (phase === 'scene' && !hasSceneImage) {
      // 画像がない場合のみ即座に音声開始
      return startSceneAudioSequence(1000);
    }

    if (phase === 'quiz') {
      const englishSrc = assets?.audio?.english;
      if (!englishSrc) {
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
        return;
      }

      const audio = new Audio(englishSrc);
      audioRef.current = audio;

      const handleEnded = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
      };

      const handleError = () => {
        console.warn('クイズ用の英語音声の自動再生に失敗しました。');
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      playbackTimeoutRef.current = window.setTimeout(() => {
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'playing' });
        audio
          .play()
          .catch(() => {
            console.warn('クイズ用の英語音声の自動再生に失敗しました。');
            dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
          })
          .finally(() => {
            playbackTimeoutRef.current = null;
          });
      }, 1000);

      return () => {
        if (playbackTimeoutRef.current) {
          clearTimeout(playbackTimeoutRef.current);
          playbackTimeoutRef.current = null;
        }
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.pause();
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        dispatch({ type: 'SET_AUDIO_STATUS', payload: 'idle' });
      };
    }
  }, [assets, isCorrect, phase, sceneImage, startSceneAudioSequence]);

  // 画像ロード完了時に音声を開始するuseEffect
  useEffect(() => {
    const hasSceneImage = Boolean(sceneImage) && !isImageHiddenModeRef.current;

    if (phase === 'scene' && imageLoaded && hasSceneImage) {
      return startSceneAudioSequence(500); // 画像ロード後は短い待機時間
    }
  }, [phase, imageLoaded, sceneImage, startSceneAudioSequence]);

  useEffect(() => {
    dispatch({ type: 'RESET' });
    isPrefetchingNextRef.current = false;
  }, [dispatch, length, searchQuery]);

  // ページ読み込み時に問題を事前フェッチ
  useEffect(() => {
    let cancelled = false;

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

        if (!cancelled) {
          dispatch({ type: 'FETCH_SUCCESS', payload: { phase: 'bootstrapping', ...payload } });
          console.log('[ProblemFlow] 事前フェッチ完了:', data.problem.englishSentence);
        }
      } catch (err) {
        console.error('[ProblemFlow] 事前フェッチ失敗:', err);
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '問題取得に失敗しました';
          dispatch({ type: 'FETCH_FAILURE', payload: { phase: 'bootstrapping', message } });
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [buildPayloadFromResponse, length, searchQuery]);

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

  useEffect(() => {
    if (!problem) return;
    if (nextProblem) return;
    if (isPrefetchingNextRef.current) return;

    void prefetchNextProblem();
  }, [problem, nextProblem, prefetchNextProblem]);

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

  useEffect(() => {
    if (phase !== 'result') return;
    if (!isCorrect) return;
    if (nextProblem) return;

    void prefetchNextProblem();
  }, [isCorrect, nextProblem, phase, prefetchNextProblem]);

  const handleStart = () => {
    if (!isReady || !problem || !assets) return;

    // 事前フェッチ済みの問題を使って即座にsceneフェーズに移行
    dispatch({ type: 'SET_SELECTED_OPTION', payload: null });
    dispatch({ type: 'SET_PHASE', payload: 'scene' });
  };

  const handleRetryQuiz = () => {
    if (!problem) return;

    const { options, correctIndex: newCorrectIndex } = shuffleOptions(problem);
    dispatch({ type: 'SET_SELECTED_OPTION', payload: null });
    dispatch({ type: 'SET_OPTIONS', payload: { options, correctIndex: newCorrectIndex } });
    dispatch({ type: 'SET_PHASE', payload: 'scene' });
  };

  const handleNextProblem = () => {
    if (isFetching) return;

    router.replace(pathname);

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
            className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-lg font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition hover:bg-[#257682] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isReady || !!error}
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

      {phase === 'scene' && (
        <section className="grid place-items-center">
          <figure className="flex w-full justify-center">
            {sceneImage && !isImageHiddenMode ? (
              <Image
                src={sceneImage}
                alt="英語と日本語のセリフを並べた2コマシーン"
                width={500}
                height={750}
                className="h-auto w-full max-w-[500px] object-contain"
                priority
                unoptimized={Boolean(sceneImage)}
                onLoad={() => dispatch({ type: 'SET_IMAGE_LOADED', payload: true })}
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
                    dispatch({ type: 'SET_SELECTED_OPTION', payload: index });
                    dispatch({ type: 'SET_PHASE', payload: 'result' });
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
              onClick={playEnglishAudio}
              className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition hover:bg-[#257682] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!assets?.audio?.english || isAudioBusy}
            >
              {isAudioActivelyPlaying || audioStatus === 'queued' ? '再生中...' : 'もう一度聞く'}
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
                className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition hover:border-[#d77a61] hover:text-[#d77a61] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAudioBusy}
              >
                再挑戦
              </button>
            )}
            {isCorrect && (
              <button
                type="button"
                onClick={handleNextProblem}
                className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 transition hover:bg-[#c3684f] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isFetching || isAudioBusy}
              >
                {isFetching ? '生成中…' : '次の問題へ'}
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
