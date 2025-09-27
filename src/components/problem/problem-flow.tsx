'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Problem } from '@prisma/client';

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
  const [phase, setPhase] = useState<Phase>('landing');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [assets, setAssets] = useState<AssetsData | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState<'generating' | 'retrieving' | null>(null);
  const [isReady, setIsReady] = useState(false); // 問題が準備済みかどうか
  const [nextProblem, setNextProblem] = useState<ProblemData | null>(null); // 次の問題
  const [nextAssets, setNextAssets] = useState<AssetsData | null>(null); // 次の問題のアセット
  const [imageLoaded, setImageLoaded] = useState(false); // 画像の読み込み状況
  const [isAudioPlaying, setIsAudioPlaying] = useState(false); // 音声再生中かどうか
  const [isEnglishMode, setIsEnglishMode] = useState(false); // 日本語音声なし
  const [isImageHiddenMode, setIsImageHiddenMode] = useState(false); // 画像なし

  const sceneImage = assets?.image ?? null;

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

      setIsEnglishMode(savedEnglishMode === 'true');
      setIsImageHiddenMode(savedNoImageMode === 'true');
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
  const isCorrect = problem != null && selectedOption === correctIndex;

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
          setPhase('quiz');
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

        secondaryPlaybackTimeoutRef.current = window.setTimeout(() => {
          japaneseAudio
            ?.play()
            .catch(() => {
              const audioType = englishMode ? '英語返答音声' : '日本語音声';
              console.warn(`${audioType}の自動再生に失敗しました。`);
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
          if (isMountedRef.current) startJapanesePlayback();
        };

        englishAudio = new Audio(englishSrc);
        audioRef.current = englishAudio;
        englishAudio.addEventListener('ended', handleEnglishEnded);

        playbackTimeoutRef.current = window.setTimeout(() => {
          setIsAudioPlaying(true);
          englishAudio
            ?.play()
            .catch(() => {
              console.warn('英語音声の自動再生に失敗しました。');
              setIsAudioPlaying(false);
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
      };
    },
    [assets],
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
      setIsAudioPlaying(false);
    };

    const handleError = () => {
      console.warn('英語音声の再生に失敗しました。');
      setIsAudioPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    setIsAudioPlaying(true);
    audio.play().catch(() => {
      console.warn('英語音声の再生に失敗しました。');
      setIsAudioPlaying(false);
    });

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setIsAudioPlaying(false);
    };
  }, [assets?.audio?.english]);

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

    // フェーズが変わるときに画像読み込み状況をリセット
    if (phase === 'scene') {
      setImageLoaded(false);
    }

    // フェーズが変わるときに音声再生状態を設定
    // scene, quizフェーズでは音声が自動再生されるため、最初からdisabledにする
    // resultフェーズでは正解時のみ音声が再生される
    if (phase === 'scene' || phase === 'quiz') {
      setIsAudioPlaying(true);
    } else if (phase === 'result' && isCorrect) {
      setIsAudioPlaying(true);
    } else {
      setIsAudioPlaying(false);
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
        setIsAudioPlaying(false);
      };

      const handleError = () => {
        console.warn('正解音声の再生に失敗しました。');
        setIsAudioPlaying(false);
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      playbackTimeoutRef.current = window.setTimeout(() => {
        setIsAudioPlaying(true);
        audio
          .play()
          .catch(() => {
            console.warn('正解音声の再生に失敗しました。');
            setIsAudioPlaying(false);
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
        audio.pause();
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
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
        return;
      }

      const audio = new Audio(englishSrc);
      audioRef.current = audio;

      const handleEnded = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        setIsAudioPlaying(false);
      };

      const handleError = () => {
        console.warn('クイズ用の英語音声の自動再生に失敗しました。');
        setIsAudioPlaying(false);
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      playbackTimeoutRef.current = window.setTimeout(() => {
        setIsAudioPlaying(true);
        audio
          .play()
          .catch(() => {
            console.warn('クイズ用の英語音声の自動再生に失敗しました。');
            setIsAudioPlaying(false);
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
        audio.pause();
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
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
    setPhase('landing');
    setProblem(null);
    setAssets(null);
    setSelectedOption(null);
    setError(null);
    setIsFetching(false);
    setFetchingStatus(null);
    setIsReady(false);
    setNextProblem(null);
    setNextAssets(null);
    setImageLoaded(false);
    setIsAudioPlaying(false);
    isPrefetchingNextRef.current = false;
  }, [length]);

  // ページ読み込み時に問題を事前フェッチ
  useEffect(() => {
    const prefetchProblem = async () => {
      setIsFetching(true);
      setFetchingStatus('retrieving');
      setError(null);

      try {
        const params = new URLSearchParams({ type: length });
        const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

        if (response.ok) {
          const data: ApiResponse = await response.json();
          const image = data.assets?.imageUrl ?? null;
          const audio = {
            english: data.assets?.audio?.english,
            japanese: data.assets?.audio?.japanese,
            englishReply: data.assets?.audio?.englishReply,
          };

          // 選択肢をシャッフルして設定
          const allOptions = [data.problem.japaneseSentence, ...data.problem.incorrectOptions];
          const zipped = allOptions.map((option, index) => ({ option, index }));

          for (let i = zipped.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
          }

          const shuffled = zipped.map((item) => item.option);
          const newCorrectIndex = zipped.findIndex((item) => item.index === 0);

          setProblem(data.problem);
          setAssets({
            image,
            imagePrompt: data.assets?.imagePrompt,
            audio,
          });
          setShuffledOptions(shuffled);
          setCorrectIndex(newCorrectIndex === -1 ? 0 : newCorrectIndex);
          setIsReady(true);
          console.log('[ProblemFlow] 事前フェッチ完了:', data.problem.englishSentence);
        } else {
          throw new Error('問題がありません');
        }
      } catch (err) {
        console.error('[ProblemFlow] 事前フェッチ失敗:', err);
        setError(err instanceof Error ? err.message : '問題取得に失敗しました');
      } finally {
        setIsFetching(false);
        setFetchingStatus(null);
      }
    };

    void prefetchProblem();
  }, [length]);

  // 次の問題を事前フェッチする関数
  const prefetchNextProblem = useCallback(async () => {
    if (isPrefetchingNextRef.current) return;

    isPrefetchingNextRef.current = true;
    try {
      const params = new URLSearchParams({ type: length });
      const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiResponse = await response.json();
        const image = data.assets?.imageUrl ?? null;
        const audio = {
          english: data.assets?.audio?.english,
          japanese: data.assets?.audio?.japanese,
          englishReply: data.assets?.audio?.englishReply,
        };

        setNextProblem(data.problem);
        setNextAssets({
          image,
          imagePrompt: data.assets?.imagePrompt,
          audio,
        });
        console.log('[ProblemFlow] 次の問題の事前フェッチ完了:', data.problem.englishSentence);
      }
    } catch (err) {
      console.warn('[ProblemFlow] 次の問題の事前フェッチ失敗:', err);
    } finally {
      isPrefetchingNextRef.current = false;
    }
  }, [length]);

  useEffect(() => {
    if (!problem) return;
    if (nextProblem) return;
    if (isPrefetchingNextRef.current) return;

    void prefetchNextProblem();
  }, [problem, nextProblem, prefetchNextProblem]);

  const fetchProblem = useCallback(async () => {
    setIsFetching(true);
    setFetchingStatus('retrieving');
    setError(null);

    try {
      const params = new URLSearchParams({ type: length });
      const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiResponse = await response.json();
        const image = data.assets?.imageUrl ?? null;
        const audio = {
          english: data.assets?.audio?.english,
          japanese: data.assets?.audio?.japanese,
          englishReply: data.assets?.audio?.englishReply,
        };

        // 選択肢をシャッフルして設定
        const allOptions = [data.problem.japaneseSentence, ...data.problem.incorrectOptions];
        const zipped = allOptions.map((option, index) => ({ option, index }));

        for (let i = zipped.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
        }

        const shuffled = zipped.map((item) => item.option);
        const newCorrectIndex = zipped.findIndex((item) => item.index === 0);

        setProblem(data.problem);
        setAssets({
          image,
          imagePrompt: data.assets?.imagePrompt,
          audio,
        });
        setShuffledOptions(shuffled);
        setCorrectIndex(newCorrectIndex === -1 ? 0 : newCorrectIndex);
        setSelectedOption(null);

        if (isMountedRef.current) {
          setPhase('scene');
        }
        console.log('[ProblemFlow] 新しい問題取得完了:', data.problem.englishSentence);
      } else {
        throw new Error('問題がありません');
      }
    } catch (err) {
      console.error('[ProblemFlow] 問題取得失敗:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : '問題取得に失敗しました');
        setPhase('landing');
      }
    } finally {
      if (isMountedRef.current) {
        setIsFetching(false);
        setFetchingStatus(null);
      }
    }
  }, [length]);

  useEffect(() => {
    if (phase !== 'result') return;
    if (!isCorrect) return;
    if (nextProblem) return;

    void prefetchNextProblem();
  }, [isCorrect, nextProblem, phase, prefetchNextProblem]);

  const handleStart = () => {
    if (!isReady || !problem || !assets) return;

    // 事前フェッチ済みの問題を使って即座にsceneフェーズに移行
    setSelectedOption(null);
    setImageLoaded(false);
    setPhase('scene');
  };

  const handleRetryQuiz = () => {
    setSelectedOption(null);
    setImageLoaded(false);
    if (assets) {
      setAssets((prev) => {
        if (!prev) {
          return prev;
        }

        if (!problem) {
          return prev;
        }

        // 新しいスキーマでは japaneseSentence が正解、incorrectOptions が不正解
        const allOptions = [problem.japaneseSentence, ...problem.incorrectOptions];
        const zipped = allOptions.map((option, index) => ({ option, index }));
        if (zipped.length === 0) {
          return prev;
        }

        for (let i = zipped.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
        }

        const reshuffledOptions = zipped.map((item) => item.option);
        const newCorrectIndex = zipped.findIndex((item) => item.index === 0); // 正解は元々 index 0

        setShuffledOptions(reshuffledOptions);
        setCorrectIndex(newCorrectIndex === -1 ? 0 : newCorrectIndex);

        return prev;
      });
    }

    setPhase('scene');
  };

  const handleNextProblem = () => {
    if (isFetching) return;

    // 次の問題が事前フェッチ済みの場合は即座に切り替え
    if (nextProblem && nextAssets) {
      // 次の問題の選択肢をシャッフル
      const allOptions = [nextProblem.japaneseSentence, ...nextProblem.incorrectOptions];
      const zipped = allOptions.map((option, index) => ({ option, index }));

      for (let i = zipped.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
      }

      const shuffled = zipped.map((item) => item.option);
      const newCorrectIndex = zipped.findIndex((item) => item.index === 0);

      setProblem(nextProblem);
      setAssets(nextAssets);
      setShuffledOptions(shuffled);
      setCorrectIndex(newCorrectIndex === -1 ? 0 : newCorrectIndex);
      setSelectedOption(null);
      setImageLoaded(false);
      setPhase('scene');

      // 現在の問題を次の問題用の変数にクリア
      setNextProblem(null);
      setNextAssets(null);
    } else {
      // 事前フェッチされていない場合は従来通り
      setPhase('loading');
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
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#c5d7d3] bg-[#edf2f1] px-6 py-20 text-center text-[#4b5a58]">
          {fetchingStatus === 'generating' && '新しい問題を生成中...'}
          {fetchingStatus === 'retrieving' && '問題を取得中...'}
          {!fetchingStatus && '処理中...'}
        </section>
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
                onLoad={() => setImageLoaded(true)}
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
                    setSelectedOption(index);
                    setPhase('result');
                  }}
                  className="w-full rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-left text-base font-medium text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#2f8f9d] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isAudioPlaying}
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
              disabled={!assets?.audio?.english || isAudioPlaying}
            >
              {isAudioPlaying ? '再生中...' : 'もう一度聞く'}
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
                <p className="mt-4 text-lg font-semibold text-[#2a2b3c]">
                  {problem.englishSentence}
                </p>
                <p className="mt-4 text-lg font-semibold text-[#2a2b3c]">
                  {problem.japaneseSentence}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-row gap-3 items-center justify-center">
            {!isCorrect && (
              <button
                type="button"
                onClick={handleRetryQuiz}
                className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition hover:border-[#d77a61] hover:text-[#d77a61] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAudioPlaying}
              >
                再挑戦
              </button>
            )}
            {isCorrect && (
              <button
                type="button"
                onClick={handleNextProblem}
                className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 transition hover:bg-[#c3684f] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isFetching || isAudioPlaying}
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
