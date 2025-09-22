'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'landing' | 'loading' | 'scene' | 'quiz' | 'result';

type ProblemType = 'short' | 'medium' | 'long';

export type ProblemLength = 'short' | 'medium' | 'long';

type ProblemFlowProps = {
  length: ProblemLength;
};

type InteractionIntent = 'request' | 'question' | 'opinion' | 'agreement' | 'info';

type ProblemData = {
  type: ProblemType;
  english: string;
  japaneseReply: string;
  options: string[];
  correctIndex: number;
  nuance: string;
  genre: string;
  scenePrompt?: string;
  speakers: {
    sceneA: 'male' | 'female' | 'neutral';
    sceneB: 'male' | 'female' | 'neutral';
  };
  wordCount?: number;
  interactionIntent?: InteractionIntent;
};

type AssetsData = {
  image: string | null;
  imagePrompt?: string;
  audio: {
    english?: string;
    japanese?: string;
  };
};

type ApiAssets = {
  composite?: string;
  imagePrompt?: string;
  audio?: {
    english?: string;
    japanese?: string;
  };
};

type ApiResponse = {
  problem: ProblemData;
  assets: ApiAssets;
};

const PROBLEM_TYPE_MAP: Record<ProblemLength, ProblemType> = {
  short: 'short',
  medium: 'medium',
  long: 'long',
};

export default function ProblemFlow({ length }: ProblemFlowProps) {
  const [phase, setPhase] = useState<Phase>('landing');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [assets, setAssets] = useState<AssetsData | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState<'generating' | 'retrieving' | null>(null);
  const [isReady, setIsReady] = useState(false); // 問題が準備済みかどうか
  const [nextProblem, setNextProblem] = useState<ProblemData | null>(null); // 次の問題
  const [nextAssets, setNextAssets] = useState<AssetsData | null>(null); // 次の問題のアセット
  const [imageLoaded, setImageLoaded] = useState(false); // 画像の読み込み状況

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const secondaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  const secondaryPlaybackTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);

  const problemType = PROBLEM_TYPE_MAP[length];
  const isCorrect = problem != null && selectedOption === problem.correctIndex;

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
    };

    audio.addEventListener('ended', handleEnded);
    audio.play().catch(() => {
      console.warn('英語音声の再生に失敗しました。');
    });

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
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
      };

      audio.addEventListener('ended', handleEnded);
      playbackTimeoutRef.current = window.setTimeout(() => {
        audio
          .play()
          .catch(() => console.warn('正解音声の再生に失敗しました。'))
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

    if (phase === 'scene') {
      const englishSrc = assets?.audio?.english;
      const japaneseSrc = assets?.audio?.japanese;

      let englishAudio: HTMLAudioElement | null = null;
      let japaneseAudio: HTMLAudioElement | null = null;
      let handleEnglishEnded: (() => void) | null = null;
      let handleJapaneseEnded: (() => void) | null = null;

      const queueQuizTransition = () => {
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        if (isMountedRef.current) {
          setPhase('quiz');
        }
      };

      const startJapanesePlayback = () => {
        if (japaneseAudio || !japaneseSrc) {
          queueQuizTransition();
          return;
        }

        handleJapaneseEnded = () => {
          if (!isMountedRef.current) {
            return;
          }
          queueQuizTransition();
        };

        japaneseAudio = new Audio(japaneseSrc);
        secondaryAudioRef.current = japaneseAudio;

        japaneseAudio.addEventListener('ended', handleJapaneseEnded);

        secondaryPlaybackTimeoutRef.current = window.setTimeout(() => {
          japaneseAudio
            ?.play()
            .catch(() => {
              console.warn('日本語音声の自動再生に失敗しました。');
              queueQuizTransition();
            })
            .finally(() => {
              secondaryPlaybackTimeoutRef.current = null;
            });
        }, 300);
      };

      const startAudioPlayback = () => {
        if (englishSrc) {
          handleEnglishEnded = () => {
            if (!isMountedRef.current) {
              return;
            }
            startJapanesePlayback();
          };

          englishAudio = new Audio(englishSrc);
          audioRef.current = englishAudio;

          englishAudio.addEventListener('ended', handleEnglishEnded);

          playbackTimeoutRef.current = window.setTimeout(() => {
            englishAudio
              ?.play()
              .catch(() => {
                console.warn('英語音声の自動再生に失敗しました。');
                handleEnglishEnded?.();
              })
              .finally(() => {
                playbackTimeoutRef.current = null;
              });
          }, 1000);
        } else {
          startJapanesePlayback();
        }
      };

      // 画像がない場合のみ即座に音声開始（画像がある場合は別のuseEffectで処理）
      if (!assets?.image) {
        startAudioPlayback();
      }

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
        if (englishAudio && handleEnglishEnded) {
          englishAudio.removeEventListener('ended', handleEnglishEnded);
        }
        if (japaneseAudio && handleJapaneseEnded) {
          japaneseAudio.removeEventListener('ended', handleJapaneseEnded);
        }
        englishAudio?.pause();
        if (audioRef.current === englishAudio) {
          audioRef.current = null;
        }
        japaneseAudio?.pause();
        if (secondaryAudioRef.current === japaneseAudio) {
          secondaryAudioRef.current = null;
        }
      };
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
      };

      audio.addEventListener('ended', handleEnded);

      playbackTimeoutRef.current = window.setTimeout(() => {
        audio
          .play()
          .catch(() => {
            console.warn('クイズ用の英語音声の自動再生に失敗しました。');
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
  }, [assets, isCorrect, phase]);

  // 画像読み込み完了時の音声再生を別のuseEffectで管理
  useEffect(() => {
    if (phase === 'scene' && assets?.image && imageLoaded) {
      // 画像が読み込まれたら音声再生を開始
      const englishSrc = assets?.audio?.english;
      const japaneseSrc = assets?.audio?.japanese;

      let englishAudio: HTMLAudioElement | null = null;
      let japaneseAudio: HTMLAudioElement | null = null;
      let handleEnglishEnded: (() => void) | null = null;
      let handleJapaneseEnded: (() => void) | null = null;

      const queueQuizTransition = () => {
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        if (isMountedRef.current) {
          setPhase('quiz');
        }
      };

      const startJapanesePlayback = () => {
        if (japaneseAudio || !japaneseSrc) {
          queueQuizTransition();
          return;
        }

        handleJapaneseEnded = () => {
          if (!isMountedRef.current) {
            return;
          }
          queueQuizTransition();
        };

        japaneseAudio = new Audio(japaneseSrc);
        secondaryAudioRef.current = japaneseAudio;

        japaneseAudio.addEventListener('ended', handleJapaneseEnded);

        secondaryPlaybackTimeoutRef.current = window.setTimeout(() => {
          japaneseAudio
            ?.play()
            .catch(() => {
              console.warn('日本語音声の自動再生に失敗しました。');
              queueQuizTransition();
            })
            .finally(() => {
              secondaryPlaybackTimeoutRef.current = null;
            });
        }, 300);
      };

      if (englishSrc) {
        handleEnglishEnded = () => {
          if (!isMountedRef.current) {
            return;
          }
          startJapanesePlayback();
        };

        englishAudio = new Audio(englishSrc);
        audioRef.current = englishAudio;

        englishAudio.addEventListener('ended', handleEnglishEnded);

        playbackTimeoutRef.current = window.setTimeout(() => {
          englishAudio
            ?.play()
            .catch(() => {
              console.warn('英語音声の自動再生に失敗しました。');
              handleEnglishEnded?.();
            })
            .finally(() => {
              playbackTimeoutRef.current = null;
            });
        }, 1000);
      } else {
        startJapanesePlayback();
      }

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
        if (englishAudio && handleEnglishEnded) {
          englishAudio.removeEventListener('ended', handleEnglishEnded);
        }
        if (japaneseAudio && handleJapaneseEnded) {
          japaneseAudio.removeEventListener('ended', handleJapaneseEnded);
        }
        englishAudio?.pause();
        if (audioRef.current === englishAudio) {
          audioRef.current = null;
        }
        japaneseAudio?.pause();
        if (secondaryAudioRef.current === japaneseAudio) {
          secondaryAudioRef.current = null;
        }
      };
    }
  }, [phase, assets, imageLoaded]);

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
  }, [problemType]);

  // ページ読み込み時に問題を事前フェッチ
  useEffect(() => {
    const prefetchProblem = async () => {
      setIsFetching(true);
      setFetchingStatus('retrieving');
      setError(null);

      try {
        const params = new URLSearchParams({ type: problemType });
        const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

        if (response.ok) {
          const data: ApiResponse = await response.json();
          const image = data.assets?.composite ?? null;
          const audio = {
            english: data.assets?.audio?.english,
            japanese: data.assets?.audio?.japanese,
          };

          setProblem(data.problem);
          setAssets({
            image,
            imagePrompt: data.assets?.imagePrompt,
            audio,
          });
          setIsReady(true);
          console.log('[ProblemFlow] 事前フェッチ完了:', data.problem.english);

          // 最初の問題が準備できたら、次の問題も事前フェッチ
          setTimeout(() => {
            void prefetchNextProblem();
          }, 100);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemType]);

  // 次の問題を事前フェッチする関数
  const prefetchNextProblem = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: problemType });
      const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiResponse = await response.json();
        const image = data.assets?.composite ?? null;
        const audio = {
          english: data.assets?.audio?.english,
          japanese: data.assets?.audio?.japanese,
        };

        setNextProblem(data.problem);
        setNextAssets({
          image,
          imagePrompt: data.assets?.imagePrompt,
          audio,
        });
        console.log('[ProblemFlow] 次の問題の事前フェッチ完了:', data.problem.english);
      }
    } catch (err) {
      console.warn('[ProblemFlow] 次の問題の事前フェッチ失敗:', err);
    }
  }, [problemType]);

  const fetchProblem = useCallback(async () => {
    setIsFetching(true);
    setFetchingStatus('retrieving');
    setError(null);

    try {
      const params = new URLSearchParams({ type: problemType });
      const response = await fetch(`/api/problem?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiResponse = await response.json();
        const image = data.assets?.composite ?? null;
        const audio = {
          english: data.assets?.audio?.english,
          japanese: data.assets?.audio?.japanese,
        };

        setProblem(data.problem);
        setAssets({
          image,
          imagePrompt: data.assets?.imagePrompt,
          audio,
        });
        setSelectedOption(null);

        if (isMountedRef.current) {
          setPhase('scene');
        }
        console.log('[ProblemFlow] 新しい問題取得完了:', data.problem.english);

        // 新しい問題が取得できたら、次の問題も事前フェッチ
        setTimeout(() => {
          void prefetchNextProblem();
        }, 100);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemType]);

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

        const zipped = problem?.options.map((option, index) => ({ option, index })) ?? [];
        if (!problem || zipped.length === 0) {
          return prev;
        }

        for (let i = zipped.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
        }

        const reshuffledOptions = zipped.map((item) => item.option);
        const correctIndex = zipped.findIndex((item) => item.index === problem.correctIndex);

        setProblem((prevProblem) => {
          if (!prevProblem) {
            return prevProblem;
          }

          return {
            ...prevProblem,
            options: reshuffledOptions,
            correctIndex: correctIndex === -1 ? 0 : correctIndex,
          };
        });

        return prev;
      });
    }

    setPhase('scene');
  };

  const handleNextProblem = () => {
    if (isFetching) return;

    // 次の問題が事前フェッチ済みの場合は即座に切り替え
    if (nextProblem && nextAssets) {
      setProblem(nextProblem);
      setAssets(nextAssets);
      setSelectedOption(null);
      setImageLoaded(false);
      setPhase('scene');

      // 現在の問題を次の問題用の変数にクリア
      setNextProblem(null);
      setNextAssets(null);

      // さらに次の問題を事前フェッチ
      void prefetchNextProblem();
    } else {
      // 事前フェッチされていない場合は従来通り
      setPhase('loading');
      void fetchProblem();
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 font-sans text-[#2a2b3c] sm:px-6 lg:max-w-4xl">
      {phase === 'landing' && (
        <div className="flex flex-col items-center gap-4 text-center">
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
            {assets?.image ? (
              <Image
                src={assets.image}
                alt="英語と日本語のセリフを並べた2コマシーン"
                width={500}
                height={750}
                className="h-auto w-full max-w-[500px] object-contain"
                priority
                unoptimized={Boolean(assets)}
                onLoad={() => setImageLoaded(true)}
              />
            ) : problem?.scenePrompt ? (
              <div className="w-full max-w-[500px] p-4 text-sm text-[#2a2b3c] leading-relaxed bg-white rounded-lg border border-[#d8cbb6]">
                <h3 className="font-semibold mb-2 text-[#2f8f9d]">シーンプロンプト:</h3>
                <p className="whitespace-pre-wrap">{problem.scenePrompt}</p>
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
          <div className="flex items-center gap-4">
            <p className="text-xl font-semibold text-[#2a2b3c] sm:text-2xl">この英文の意味は？</p>
            <button
              type="button"
              onClick={playEnglishAudio}
              className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-4 py-2 text-sm font-medium text-[#ffffff] shadow-lg shadow-[#2f8f9d]/30 transition hover:bg-[#257682] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffffff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!assets?.audio?.english}
            >
              もう一度聞く
            </button>
          </div>
          <ul className="grid gap-3">
            {problem.options.map((option, index) => (
              <li key={`${option}-${index}`}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOption(index);
                    setPhase('result');
                  }}
                  className="w-full rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-left text-base font-medium text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition hover:border-[#2f8f9d] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d]"
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
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
                <p className="mt-4 text-lg font-semibold text-[#2a2b3c]">{problem.english}</p>
                <p className="mt-4 text-lg font-semibold text-[#2a2b3c]">
                  {problem.options[problem.correctIndex]}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-row gap-3 items-center justify-center">
            {!isCorrect && (
              <button
                type="button"
                onClick={handleRetryQuiz}
                className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition hover:border-[#d77a61] hover:text-[#d77a61]"
              >
                再挑戦
              </button>
            )}
            {isCorrect && (
              <button
                type="button"
                onClick={handleNextProblem}
                className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 transition hover:bg-[#c3684f] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isFetching}
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
