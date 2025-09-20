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
  debug?: boolean;
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

          if (assets?.audio?.japanese) {
            const japaneseAudio = new Audio(assets.audio.japanese);
            secondaryAudioRef.current = japaneseAudio;
            secondaryPlaybackTimeoutRef.current = window.setTimeout(() => {
              japaneseAudio
                .play()
                .catch(() => {
                  console.warn('日本語音声の自動再生に失敗しました');
                })
                .finally(() => {
                  secondaryPlaybackTimeoutRef.current = null;
                });
            }, 1000);
          }
        } else {
          console.info(`${languageLabel}音声の再生が終了しました`);
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
      setProblem(data.problem);
      setAssets(data.assets);
      setSelectedOption(null);

      if (isMountedRef.current) {
        setPhase('sceneA');
      }
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
    setPhase('sceneA');
  };

  const handleNextProblem = () => {
    if (isFetching) return;
    setPhase('loading');
    void fetchProblem();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 font-sans text-slate-900 sm:px-6 lg:max-w-4xl">
      {phase === 'landing' && (
        <section className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-6 py-20 text-center shadow-lg shadow-slate-900/10">
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-lg font-semibold text-slate-50 shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isFetching}
          >
            {isFetching ? '生成中…' : '英語学習を始める'}
          </button>
        </section>
      )}

      {phase === 'loading' && (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center text-slate-500">
          生成中です...
        </section>
      )}

      {phase === 'sceneA' && (
        <section className="grid place-items-center">
          {assets?.debug ? (
            <p className="rounded-3xl border border-dashed border-slate-400 bg-slate-50 px-6 py-8 text-sm text-slate-700">
              {assets.sceneA}
            </p>
          ) : (
            <figure className="w-full overflow-hidden rounded-3xl border border-slate-200 shadow-2xl shadow-slate-900/10">
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
          )}
        </section>
      )}

      {phase === 'sceneB' && (
        <section className="grid place-items-center">
          {assets?.debug ? (
            <p className="rounded-3xl border border-dashed border-slate-400 bg-slate-50 px-6 py-8 text-sm text-slate-700">
              {assets.sceneB}
            </p>
          ) : (
            <figure className="w-full overflow-hidden rounded-3xl border border-slate-200 shadow-2xl shadow-slate-900/10">
              <Image
                src={assets?.sceneB ?? FALLBACK_SCENE_B}
                alt="日本語で返答するシーン"
                width={1920}
                height={1080}
                className="h-full w-full object-cover"
                unoptimized={Boolean(assets)}
              />
            </figure>
          )}
        </section>
      )}

      {phase === 'quiz' && problem && (
        <section className="grid gap-8">
          <p className="text-xl font-semibold text-slate-900 sm:text-2xl">この英文の意味は？</p>
          <ul className="grid gap-3">
            {problem.options.map((option, index) => (
              <li key={`${option}-${index}`}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOption(index);
                    setPhase('result');
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left text-base font-medium text-slate-800 shadow-sm shadow-slate-900/5 transition hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
                <p className="mt-4 text-base text-slate-800">{problem.english}</p>
                <p className="mt-4 text-base text-slate-800">
                  {problem.options[problem.correctIndex]}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={handleRetryQuiz}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
            >
              再挑戦
            </button>
            {isCorrect && (
              <button
                type="button"
                onClick={handleNextProblem}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-base font-semibold text-slate-50 shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
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
