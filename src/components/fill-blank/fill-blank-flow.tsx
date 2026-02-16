'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { generateBlankProblem, type BlankProblemData } from '@/lib/fill-blank-utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ALLOWED_SHARE_COUNTS } from '@/const';
import { StartButton } from '@/components/ui/start-button';

type ProblemWithStaticFlag = ProblemWithAudio & { isStatic?: boolean };

type Phase =
  | {
      kind: 'start';
      problem: ProblemWithStaticFlag;
    }
  | {
      kind: 'quiz';
      problem: ProblemWithStaticFlag;
      blankProblem: BlankProblemData;
    }
  | {
      kind: 'correct';
      problem: ProblemWithStaticFlag;
      blankProblem: BlankProblemData;
    }
  | {
      kind: 'incorrect';
      problem: ProblemWithStaticFlag;
      blankProblem: BlankProblemData;
    };

type ApiProblemsResponse = {
  problems: ProblemWithAudio[];
  count: number;
};

type FillBlankFlowProps = {
  initialProblem: ProblemWithStaticFlag;
};

export default function FillBlankFlow({ initialProblem }: FillBlankFlowProps) {
  const [correctStreak, setCorrectStreak] = useLocalStorage('correctStreak-fill-blank', 0);

  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() ?? '';
  const router = useRouter();
  const pathname = usePathname();

  const [phase, setPhase] = useState<Phase>({
    kind: 'start',
    problem: initialProblem,
  });

  const [problemQueue, setProblemQueue] = useState<ProblemWithStaticFlag[]>([]);
  const isPrefetchingRef = useRef(false);

  // キューに問題を補充（残り5問以下になったら10問取得）
  const refillQueueIfNeeded = useCallback(async () => {
    if (problemQueue.length > 5 || isPrefetchingRef.current) return;

    isPrefetchingRef.current = true;

    try {
      // 補充時は常に検索なしで取得
      const response = await fetch('/api/problems?limit=10', { cache: 'no-store' });

      if (response.ok) {
        const data: ApiProblemsResponse = await response.json();
        if (data.problems.length > 0) {
          setProblemQueue((prev) => [...prev, ...data.problems]);
        }
      }
    } catch (err) {
      console.warn('[FillBlankFlow] 問題キュー補充失敗:', err);
    } finally {
      isPrefetchingRef.current = false;
    }
  }, [problemQueue.length]);

  const handleStart = () => {
    if (phase.kind !== 'start') return;

    const blankProblem = generateBlankProblem(phase.problem);
    setPhase({
      kind: 'quiz',
      problem: phase.problem,
      blankProblem,
    });

    void refillQueueIfNeeded();
  };

  const handleOptionSelect = (selectedIndex: number) => {
    if (phase.kind !== 'quiz') return;

    const isCorrect = selectedIndex === phase.blankProblem.correctIndex;

    if (isCorrect) {
      setCorrectStreak(correctStreak + 1);
      setPhase({
        kind: 'correct',
        problem: phase.problem,
        blankProblem: phase.blankProblem,
      });
    } else {
      setCorrectStreak(0);
      setPhase({
        kind: 'incorrect',
        problem: phase.problem,
        blankProblem: phase.blankProblem,
      });
    }
  };

  const handleRetry = () => {
    if (phase.kind !== 'incorrect') return;

    // 同じblankProblemを使って再挑戦（空白の箇所は変わらない）
    setPhase({
      kind: 'quiz',
      problem: phase.problem,
      blankProblem: phase.blankProblem,
    });
  };

  const handleNextProblem = () => {
    if (phase.kind !== 'correct') return;

    // searchパラメータがある場合のみURLをクリア
    if (searchQuery) {
      router.push(pathname);
    }

    const nextProblem = problemQueue[0];

    if (!nextProblem) {
      console.error('[FillBlankFlow] 問題キューが空です');
      return;
    }

    // キューから次の問題を削除
    setProblemQueue((prev) => prev.slice(1));

    const blankProblem = generateBlankProblem(nextProblem);
    setPhase({
      kind: 'quiz',
      problem: nextProblem,
      blankProblem,
    });

    void refillQueueIfNeeded();
  };

  const isOnStreak = ALLOWED_SHARE_COUNTS.includes(
    correctStreak as (typeof ALLOWED_SHARE_COUNTS)[number],
  );

  return (
    <div className="max-w-full">
      {phase.kind === 'start' && <StartView onStart={handleStart} />}
      {phase.kind === 'quiz' && (
        <QuizView blankProblem={phase.blankProblem} onSelectOption={handleOptionSelect} />
      )}
      {phase.kind === 'correct' && (
        <CorrectView
          blankProblem={phase.blankProblem}
          problem={phase.problem}
          correctStreak={correctStreak}
          isOnStreak={isOnStreak}
          onNextProblem={handleNextProblem}
        />
      )}
      {phase.kind === 'incorrect' && <IncorrectView onRetry={handleRetry} />}
    </div>
  );
}

type StartViewProps = {
  onStart: () => void;
};

function StartView({ onStart }: StartViewProps) {
  return (
    <div className="relative w-[500px] max-w-full mx-auto aspect-[2/3]">
      <div className="absolute inset-0 flex items-center justify-center">
        <StartButton
          error={null}
          handleStart={onStart}
          disabled={false}
          autoFocus
          showAudioWarning={false}
        >
          単語穴埋めを始める
        </StartButton>
      </div>
    </div>
  );
}

type QuizViewProps = {
  blankProblem: BlankProblemData;
  onSelectOption: (index: number) => void;
};

function QuizView({ blankProblem, onSelectOption }: QuizViewProps) {
  return (
    <section className="grid w-[500px] max-w-full mx-auto pt-3">
      <div className="mb-8">
        <p className="text-center text-2xl font-semibold text-[var(--text)] leading-relaxed">
          {blankProblem.sentenceWithBlank}
        </p>
      </div>
      <ul className="grid gap-3">
        {blankProblem.options.map((option, index) => (
          <li key={`${blankProblem.problemId}-${index}`}>
            <button
              autoFocus={index === 0}
              type="button"
              onClick={() => onSelectOption(index)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-5 py-4 text-left text-base font-medium text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--primary)] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner"
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

type CorrectViewProps = {
  blankProblem: BlankProblemData;
  problem: ProblemWithStaticFlag;
  correctStreak: number;
  isOnStreak: boolean;
  onNextProblem: () => void;
};

function CorrectView({
  blankProblem,
  problem,
  correctStreak,
  isOnStreak,
  onNextProblem,
}: CorrectViewProps) {
  const [imageVariant] = useState(() => Math.floor(Math.random() * 2) + 1);

  // 正解の単語をハイライトした文を生成
  const highlightedSentence = () => {
    const { originalSentence, blankStartIndex, blankEndIndex } = blankProblem;

    const before = originalSentence.slice(0, blankStartIndex);
    const highlighted = originalSentence.slice(blankStartIndex, blankEndIndex);
    const after = originalSentence.slice(blankEndIndex);

    return (
      <>
        {before}
        <span className="underline decoration-2 underline-offset-4 font-bold">{highlighted}</span>
        {after}
      </>
    );
  };

  return (
    <section className="grid text-center w-[500px] max-w-full mx-auto pt-4">
      <div className="mb-6 text-[var(--success)]">
        <h2 className="text-4xl font-bold flex justify-center items-center gap-4">
          <div className="transform scale-x-[-1]">🎉</div>
          <div className="flex flex-row items-center justify-center gap-2 flex-wrap">
            {isOnStreak && <div>{correctStreak}問連続</div>}
            <div>正解</div>
          </div>
          <div>🎉</div>
        </h2>
        <div className="mt-6 flex justify-center max-w-[30%] sm:max-w-[120px] mx-auto relative">
          <Image
            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/correct${imageVariant}.webp`}
            alt="ガッツポーズ"
            width={500}
            height={750}
            unoptimized
            priority
            className={isOnStreak ? 'opacity-50' : ''}
          />
          {isOnStreak && (
            <button
              type="button"
              onClick={() => {
                const shareUrl = `${window.location.origin}?streak=${correctStreak}`;
                const tweetText = `【英語きわめ太郎】単語穴埋めコースで${correctStreak}問連続正解しました！`;
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
                window.open(twitterUrl, '_blank', 'width=550,height=420');
              }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-[var(--share-button-bg)] px-6 py-3 text-base font-semibold text-[var(--share-button-text)] shadow-lg shadow-[var(--share-button-shadow)]/50 enabled:hover:bg-[var(--share-button-hover)]"
            >
              𝕏 で自慢する
            </button>
          )}
        </div>
        <p className="py-4 text-2xl font-semibold text-[var(--text)] leading-relaxed">
          {highlightedSentence()}
        </p>
        <p className="text-lg text-[var(--text)]">{problem.japaneseSentence}</p>
      </div>
      <div className="flex justify-center gap-4">
        <button
          autoFocus
          type="button"
          onClick={onNextProblem}
          className="inline-flex items-center justify-center rounded-full bg-[var(--secondary)] px-6 py-3 text-base font-semibold text-[var(--secondary-text)] shadow-lg shadow-[var(--secondary)]/40 enabled:hover:bg-[var(--secondary-hover)]"
        >
          次の問題へ
        </button>
      </div>
    </section>
  );
}

type IncorrectViewProps = {
  onRetry: () => void;
};

function IncorrectView({ onRetry }: IncorrectViewProps) {
  const [imageVariant] = useState(() => Math.floor(Math.random() * 2) + 1);

  return (
    <section className="grid gap-2 text-center">
      <div className="px-6 py-6 text-[var(--error-dark)]">
        <h2 className="text-4xl font-bold pl-4">残念…</h2>
        <div className="mt-6 flex justify-center max-w-[30%] sm:max-w-[120px] mx-auto">
          <Image
            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/incorrect${imageVariant}.webp`}
            alt="ショックな様子"
            width={500}
            height={750}
            unoptimized
            priority
          />
        </div>
      </div>
      <div className="flex flex-row gap-3 items-center justify-center">
        <button
          autoFocus
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] px-6 py-3 text-base font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)]"
        >
          再挑戦
        </button>
      </div>
    </section>
  );
}
