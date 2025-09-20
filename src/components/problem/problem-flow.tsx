'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'landing' | 'loading' | 'sceneA' | 'sceneB' | 'quiz' | 'result';

type ProblemType = 'short' | 'medium' | 'long';

export type ProblemLength = 'short' | 'middle' | 'long';

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
  speakers: {
    sceneA: 'male' | 'female' | 'neutral';
    sceneB: 'male' | 'female' | 'neutral';
  };
  wordCount?: number;
  interactionIntent?: InteractionIntent;
};

type AssetsData = {
  sceneA: string;
  sceneB: string;
  audio: {
    english: string;
    japanese: string;
  };
};

type ApiResponse = {
  problem: ProblemData;
  assets: AssetsData;
};

const PROBLEM_TYPE_MAP: Record<ProblemLength, ProblemType> = {
  short: 'short',
  middle: 'medium',
  long: 'long',
};

const INCLUDE_UNREVIEWED = process.env.NEXT_PUBLIC_INCLUDE_UNREVIEWED === 'true';

const FALLBACK_SCENE_A = '/img/a.png';
const FALLBACK_SCENE_B = '/img/b.png';

export default function ProblemFlow({ length }: ProblemFlowProps) {
  const [phase, setPhase] = useState<Phase>('landing');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [assets, setAssets] = useState<AssetsData | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const secondaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  const secondaryPlaybackTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);

  const problemType = PROBLEM_TYPE_MAP[length];
  const isCorrect = problem != null && selectedOption === problem.correctIndex;

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

    if (typeof window === 'undefined') {
      return;
    }

    if (phase === 'result') {
      if (!isCorrect || !assets?.audio?.english) {
        return;
      }

      const audio = new Audio(assets.audio.english);
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

    if (phase === 'sceneA' || phase === 'sceneB' || phase === 'quiz') {
      const audioSources: Record<'sceneA' | 'sceneB' | 'quiz', string | undefined> = {
        sceneA: assets?.audio?.english,
        sceneB: assets?.audio?.japanese,
        quiz: assets?.audio?.english,
      };

      const src = audioSources[phase];
      if (!src) {
        return;
      }

      const audio = new Audio(src);
      audioRef.current = audio;

      const languageLabel = phase === 'sceneB' ? '日本語' : '英語';

      const handleEnded = () => {
        if (!isMountedRef.current) {
          return;
        }

        if (phase === 'sceneA') {
          transitionTimeoutRef.current = window.setTimeout(() => {
            if (isMountedRef.current) {
              setPhase('sceneB');
            }
            transitionTimeoutRef.current = null;
          }, 1000);
          return;
        }

        if (phase === 'sceneB') {
          transitionTimeoutRef.current = window.setTimeout(() => {
            if (isMountedRef.current) {
              setPhase('quiz');
            }
            transitionTimeoutRef.current = null;
          }, 1000);
          return;
        }

        if (phase === 'quiz') {
          if (secondaryPlaybackTimeoutRef.current) {
            clearTimeout(secondaryPlaybackTimeoutRef.current);
            secondaryPlaybackTimeoutRef.current = null;
          }

          if (secondaryAudioRef.current) {
            secondaryAudioRef.current.pause();
            secondaryAudioRef.current = null;
          }

          return;
        }
      };

      audio.addEventListener('ended', handleEnded);

      playbackTimeoutRef.current = window.setTimeout(() => {
        audio
          .play()
          .catch(() => {
            console.warn(`自動再生に失敗しました: ${languageLabel}`);
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
        if (secondaryPlaybackTimeoutRef.current) {
          clearTimeout(secondaryPlaybackTimeoutRef.current);
          secondaryPlaybackTimeoutRef.current = null;
        }
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = null;
        }
        audio.removeEventListener('ended', handleEnded);
        audio.pause();
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        if (secondaryAudioRef.current) {
          secondaryAudioRef.current.pause();
          secondaryAudioRef.current = null;
        }
      };
    }
  }, [assets, isCorrect, phase]);

  useEffect(() => {
    setPhase('landing');
    setProblem(null);
    setAssets(null);
    setSelectedOption(null);
    setError(null);
    setIsFetching(false);
  }, [problemType]);

  const fetchProblem = useCallback(async () => {
    setIsFetching(true);
    setError(null);

    const applyResponse = (data: ApiResponse) => {
      setProblem(data.problem);
      setAssets(data.assets);
      setSelectedOption(null);

      if (isMountedRef.current) {
        setPhase('sceneA');
      }
    };

    const buildCachedUrl = () => {
      const params = new URLSearchParams({ type: problemType });
      if (INCLUDE_UNREVIEWED) {
        params.set('includeUnreviewed', 'true');
      }
      return `/api/problem?${params.toString()}`;
    };

    try {
      const cachedRes = await fetch(buildCachedUrl(), { cache: 'no-store' });
      if (cachedRes.ok) {
        const cached: ApiResponse = await cachedRes.json();
        applyResponse(cached);
        if (isMountedRef.current) {
          setIsFetching(false);
        }
        return;
      }

      if (cachedRes.status !== 404) {
        const payload = await cachedRes.json().catch(() => ({}));
        throw new Error(payload?.error ?? '問題取得に失敗しました');
      }
    } catch (err) {
      console.warn('cached problem fetch failed', err);
    }

    try {
      const res = await fetch('/api/problem/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: problemType }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? '問題生成に失敗しました');
      }

      const data: ApiResponse = await res.json();
      applyResponse(data);
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : '問題生成に失敗しました');
        setPhase('landing');
      }
    } finally {
      if (isMountedRef.current) {
        setIsFetching(false);
      }
    }
  }, [problemType]);

  const handleStart = () => {
    if (isFetching) return;
    setPhase('loading');
    void fetchProblem();
  };

  const handleRetryQuiz = () => {
    setSelectedOption(null);
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

    setPhase('sceneA');
  };

  const handleNextProblem = () => {
    if (isFetching) return;
    setPhase('loading');
    void fetchProblem();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 font-sans text-[#2a2b3c] sm:px-6 lg:max-w-4xl">
      {phase === 'landing' && (
        <section className="flex flex-col items-center gap-4 rounded-3xl border border-[#d8cbb6] bg-[#ffffff] px-6 py-20 text-center shadow-lg shadow-[#d8cbb6]/40">
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-lg font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition hover:bg-[#257682] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isFetching}
          >
            {isFetching ? '生成中…' : '英語学習を始める'}
          </button>
        </section>
      )}

      {phase === 'loading' && (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#c5d7d3] bg-[#edf2f1] px-6 py-20 text-center text-[#4b5a58]">
          生成中です...
        </section>
      )}

      {phase === 'sceneA' && (
        <section className="grid place-items-center">
          <figure className="w-full overflow-hidden rounded-3xl border border-[#d8cbb6] shadow-2xl shadow-[#d8cbb6]/50">
            <Image
              src={assets?.sceneA ?? FALLBACK_SCENE_A}
              alt="英語のセリフが流れるシーン"
              width={1920}
              height={1080}
              className="h-full w-full object-cover"
              priority
              unoptimized={Boolean(assets)}
            />
          </figure>
        </section>
      )}

      {phase === 'sceneB' && (
        <section className="grid place-items-center">
          <figure className="w-full overflow-hidden rounded-3xl border border-[#d8cbb6] shadow-2xl shadow-[#d8cbb6]/50">
            <Image
              src={assets?.sceneB ?? FALLBACK_SCENE_B}
              alt="日本語で返答するシーン"
              width={1920}
              height={1080}
              className="h-full w-full object-cover"
              unoptimized={Boolean(assets)}
            />
          </figure>
        </section>
      )}

      {phase === 'quiz' && problem && (
        <section className="grid gap-8">
          <p className="text-xl font-semibold text-[#2a2b3c] sm:text-2xl">この英文の意味は？</p>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={handleRetryQuiz}
              className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition hover:border-[#d77a61] hover:text-[#d77a61]"
            >
              再挑戦
            </button>
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
