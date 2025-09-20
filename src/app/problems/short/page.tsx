'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const sceneAImage = '/img/a.png';
const sceneBImage = '/img/b.png';

type Phase = 'landing' | 'sceneA' | 'sceneB' | 'quiz' | 'result';

type AudioPhase = 'sceneA' | 'sceneB' | 'quiz';

const audioSourceMap: Record<AudioPhase, string> = {
  sceneA: '/english-placeholder.wav',
  sceneB: '/japanese-placeholder.wav',
  quiz: '/english-placeholder.wav',
};

const mockProblem = {
  type: 'short',
  englishPrompt: 'Could you pass me the salt?',
  japaneseResponse: 'はい、お塩どうぞ。',
  options: [
    'お塩を取ってくださいませんか？',
    'カレー食べたい',
    '今日は映画を見に行こう',
    'お塩とってくれない？',
  ],
  correctIndex: 3,
};

export default function ShortProblemPage() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);
  const isCorrect = selectedOption === mockProblem.correctIndex;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      audioRef.current?.pause();
      audioRef.current = null;
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
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
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    if (phase === 'result') {
      if (!isCorrect) {
        return;
      }

      const audio = new Audio(audioSourceMap.quiz);
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
            console.warn('正解音声の再生に失敗しました。');
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

    if (phase === 'landing') {
      return;
    }

    const src = audioSourceMap[phase as AudioPhase];
    if (!src || typeof window === 'undefined') {
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

      // no-op: UIでは表示しない
    };

    audio.addEventListener('ended', handleEnded);
    playbackTimeoutRef.current = window.setTimeout(() => {
      audio
        .play()
        .catch(() => {
          console.warn('自動再生に失敗しました。', languageLabel);
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
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [isCorrect, phase]);

  const handleStart = () => {
    setSelectedOption(null);
    setPhase('sceneA');
  };

  const handleRetryQuiz = () => {
    setSelectedOption(null);
    setPhase('sceneA');
  };

  const handleNextProblem = () => {
    setSelectedOption(null);
    setPhase('sceneA');
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 font-sans text-slate-900 sm:px-6 lg:max-w-4xl">
      {phase === 'landing' && (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 px-6 py-20 shadow-lg shadow-slate-900/10">
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-lg font-semibold text-slate-50 shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
          >
            英語学習を始める
          </button>
        </section>
      )}

      {phase === 'sceneA' && (
        <section className="grid place-items-center">
          <figure className="w-full overflow-hidden rounded-3xl border border-slate-200 shadow-2xl shadow-slate-900/10">
            <Image
              src={sceneAImage}
              alt="食卓で英語で話す女性の写真"
              width={1920}
              height={1080}
              className="h-full w-full object-cover"
              priority
            />
          </figure>
        </section>
      )}

      {phase === 'sceneB' && (
        <section className="grid place-items-center">
          <figure className="w-full overflow-hidden rounded-3xl border border-slate-200 shadow-2xl shadow-slate-900/10">
            <Image
              src={sceneBImage}
              alt="男性が塩を差し出す写真"
              width={1920}
              height={1080}
              className="h-full w-full object-cover"
            />
          </figure>
        </section>
      )}

      {phase === 'quiz' && (
        <section className="grid gap-8">
          <p className="text-xl font-semibold text-slate-900 sm:text-2xl">この英文の意味は？</p>
          <ul className="grid gap-3">
            {mockProblem.options.map((option, index) => (
              <li key={option}>
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

      {phase === 'result' && (
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
            <p className="mt-4 text-base text-slate-800">
              正解：{mockProblem.options[mockProblem.correctIndex]}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={handleRetryQuiz}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
            >
              再挑戦
            </button>
            <button
              type="button"
              onClick={handleNextProblem}
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-base font-semibold text-slate-50 shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
            >
              次の問題へ
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
