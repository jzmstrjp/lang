'use client';

import Image from 'next/image';
import { ExternalLink, Undo2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProblemWithAudio } from '@/lib/problem-service';
import type { DifficultyLevel } from '@/config/problem';
import {
  generateWordSortProblem,
  checkWordSortAnswer,
  type WordSortProblemData,
  type WordToken,
  type SlotToken,
} from '@/lib/word-sort-utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ALLOWED_SHARE_COUNTS, CDN_ORIGIN } from '@/const';

type Phase =
  | {
      kind: 'quiz';
      problem: ProblemWithAudio;
      sortProblem: WordSortProblemData;
      incorrectCount: number;
    }
  | { kind: 'correct'; problem: ProblemWithAudio; sortProblem: WordSortProblemData }
  | {
      kind: 'incorrect';
      problem: ProblemWithAudio;
      sortProblem: WordSortProblemData;
      incorrectCount: number;
    }
  | { kind: 'giveUp'; problem: ProblemWithAudio; sortProblem: WordSortProblemData };

type ApiProblemsResponse = {
  problems: ProblemWithAudio[];
  count: number;
};

type WordSortFlowProps = {
  initialProblem: ProblemWithAudio;
  difficultyLevel?: DifficultyLevel;
};

export default function WordSortFlow({ initialProblem, difficultyLevel }: WordSortFlowProps) {
  const [correctStreak, setCorrectStreak] = useLocalStorage('correctStreak-word-sort', 0);

  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() ?? '';
  const router = useRouter();
  const pathname = usePathname();

  const [phase, setPhase] = useState<Phase>(() => {
    const sortProblem = generateWordSortProblem(initialProblem);
    return { kind: 'quiz', problem: initialProblem, sortProblem, incorrectCount: 0 };
  });

  const [problemQueue, setProblemQueue] = useState<ProblemWithAudio[]>([]);
  const isPrefetchingRef = useRef(false);

  const refillQueueIfNeeded = useCallback(async () => {
    if (problemQueue.length > 5 || isPrefetchingRef.current) return;

    isPrefetchingRef.current = true;

    try {
      const params = new URLSearchParams({ limit: '10', maxWordCount: '13' });
      if (difficultyLevel) params.set('difficultyLevel', difficultyLevel);
      const response = await fetch(`/api/problems?${params}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiProblemsResponse = await response.json();
        if (data.problems.length > 0) {
          setProblemQueue((prev) => [...prev, ...data.problems]);
        }
      }
    } catch (err) {
      console.warn('[WordSortFlow] 問題キュー補充失敗:', err);
    } finally {
      isPrefetchingRef.current = false;
    }
  }, [problemQueue.length, difficultyLevel]);

  const didInitRef = useRef(false);
  if (!didInitRef.current) {
    didInitRef.current = true;
    void refillQueueIfNeeded();
  }

  const handleSubmit = (selectedTokens: WordToken[]) => {
    if (phase.kind !== 'quiz') return;

    const isCorrect = checkWordSortAnswer(selectedTokens, phase.sortProblem.correctSlots);

    if (isCorrect) {
      setCorrectStreak(correctStreak + 1);
      setPhase({ kind: 'correct', problem: phase.problem, sortProblem: phase.sortProblem });
    } else {
      setCorrectStreak(0);
      const nextIncorrectCount = phase.incorrectCount + 1;
      if (nextIncorrectCount >= 2) {
        setPhase({ kind: 'giveUp', problem: phase.problem, sortProblem: phase.sortProblem });
      } else {
        setPhase({
          kind: 'incorrect',
          problem: phase.problem,
          sortProblem: phase.sortProblem,
          incorrectCount: nextIncorrectCount,
        });
      }
    }
  };

  const handleRetry = () => {
    if (phase.kind !== 'incorrect') return;

    const sortProblem = generateWordSortProblem(phase.problem);
    setPhase({
      kind: 'quiz',
      problem: phase.problem,
      sortProblem,
      incorrectCount: phase.incorrectCount,
    });
  };

  const handleNextProblem = () => {
    if (phase.kind !== 'correct' && phase.kind !== 'giveUp') return;

    if (searchQuery) {
      router.push(pathname);
    }

    const nextProblem = problemQueue[0];

    if (!nextProblem) {
      console.error('[WordSortFlow] 問題キューが空です');
      return;
    }

    setProblemQueue((prev) => prev.slice(1));

    const sortProblem = generateWordSortProblem(nextProblem);
    setPhase({ kind: 'quiz', problem: nextProblem, sortProblem, incorrectCount: 0 });

    void refillQueueIfNeeded();
  };

  const isOnStreak = ALLOWED_SHARE_COUNTS.includes(
    correctStreak as (typeof ALLOWED_SHARE_COUNTS)[number],
  );

  return (
    <div className="max-w-full">
      {phase.kind === 'quiz' && (
        <QuizView problem={phase.problem} sortProblem={phase.sortProblem} onSubmit={handleSubmit} />
      )}
      {phase.kind === 'correct' && (
        <CorrectView
          problem={phase.problem}
          sortProblem={phase.sortProblem}
          correctStreak={correctStreak}
          isOnStreak={isOnStreak}
          onNextProblem={handleNextProblem}
        />
      )}
      {phase.kind === 'incorrect' && <IncorrectView onRetry={handleRetry} />}
      {phase.kind === 'giveUp' && (
        <GiveUpView sortProblem={phase.sortProblem} onNextProblem={handleNextProblem} />
      )}
    </div>
  );
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

type QuizViewProps = {
  problem: ProblemWithAudio;
  sortProblem: WordSortProblemData;
  onSubmit: (selectedTokens: WordToken[]) => void;
};

/**
 * correctSlots をもとに選択済みスロットを表示する。
 * 単語スロット → 選択済みなら単語ボタン、未選択なら下線のみ
 * 句読点スロット → そのまま表示（選択不要）
 */
function SlotArea({
  correctSlots,
  selectedIds,
  idToWord,
}: {
  correctSlots: SlotToken[];
  selectedIds: string[];
  idToWord: Map<string, string>;
}) {
  let wordCursor = 0;

  return (
    <p className="text-2xl font-semibold text-[var(--text)] leading-relaxed text-center">
      {correctSlots.map((slot) => {
        if (slot.kind === 'punctuation') {
          return (
            <span key={slot.id} className="-ml-1">
              {slot.punctuation}{' '}
            </span>
          );
        }

        const selectedId = selectedIds[wordCursor];
        wordCursor++;

        if (!selectedId) {
          return (
            <span key={slot.id}>
              <span className="inline-block w-10 border-b-2 border-[var(--text)] mx-0.5 mb-[0.35em] align-bottom" />{' '}
            </span>
          );
        }

        return (
          <span key={slot.id}>
            <span className="font-semibold text-[var(--text)]">
              {(idToWord.get(selectedId) ?? selectedId).toLowerCase()}
            </span>{' '}
          </span>
        );
      })}
    </p>
  );
}

function QuizView({ problem, sortProblem, onSubmit }: QuizViewProps) {
  // 選択済みトークンの順序リスト（選んだ順、id を格納）
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // id → word のマップ
  const idToWord = new Map(sortProblem.shuffledTokens.map((t) => [t.id, t.word]));

  const wordCount = sortProblem.shuffledTokens.length;

  const handleSelectWord = (token: WordToken) => {
    if (selectedIds.includes(token.id)) return;
    const next = [...selectedIds, token.id];
    setSelectedIds(next);
    if (next.length === wordCount) {
      const tokens: WordToken[] = next.map((id) => ({
        kind: 'word',
        id,
        word: idToWord.get(id) ?? '',
      }));
      onSubmit(tokens);
    }
  };

  return (
    <section className="grid w-[500px] max-w-full mx-auto pt-3 gap-6">
      <p className="text-center text-2xl font-bold text-[var(--text)] leading-relaxed">
        {problem.japaneseSentence}
      </p>

      {/* 選択済みスロットエリア */}
      <div className="min-h-[72px] px-4 py-2 flex items-center justify-center">
        <SlotArea
          correctSlots={sortProblem.correctSlots}
          selectedIds={selectedIds}
          idToWord={idToWord}
        />
      </div>

      {/* 単語ボタンエリア（選択済みはグレーアウト） */}
      <div className="flex flex-wrap gap-3 justify-center">
        {sortProblem.shuffledTokens.map((token) => {
          const isSelected = selectedIds.includes(token.id);
          return (
            <button
              key={token.id}
              type="button"
              disabled={isSelected}
              onClick={() => handleSelectWord(token)}
              className={`rounded-2xl border px-5 py-3 text-lg font-medium shadow-sm transition-opacity enabled:active:translate-y-[1px] ${
                isSelected
                  ? 'border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] opacity-40'
                  : 'border-[var(--border)] bg-[var(--background)] text-[var(--text)] shadow-[var(--border)]/40 hover:border-[var(--primary)] hover:shadow-md'
              }`}
            >
              {token.word.toLowerCase()}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setSelectedIds((prev) => prev.slice(0, -1))}
          disabled={selectedIds.length === 0}
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] px-5 py-3 text-base font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)] disabled:opacity-40"
        >
          <Undo2 className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

// ─── Correct ─────────────────────────────────────────────────────────────────

type CorrectViewProps = {
  problem: ProblemWithAudio;
  sortProblem: WordSortProblemData;
  correctStreak: number;
  isOnStreak: boolean;
  onNextProblem: () => void;
};

function CorrectView({ problem, correctStreak, isOnStreak, onNextProblem }: CorrectViewProps) {
  const [imageVariant] = useState(() => Math.floor(Math.random() * 2) + 1);
  const [selectedText, setSelectedText] = useState('');
  const englishSentenceRef = useRef<HTMLParagraphElement>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
        selectionTimeoutRef.current = null;
      }

      selectionTimeoutRef.current = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        if (!englishSentenceRef.current) return;

        const range = selection.getRangeAt(0);
        const selectedTextContent = range.toString().trim();
        if (!selectedTextContent) return;

        const startContainer = range.startContainer;
        const startElement =
          startContainer.nodeType === Node.TEXT_NODE
            ? startContainer.parentElement
            : (startContainer as Element);

        const isStartInParagraph =
          startElement &&
          (englishSentenceRef.current.contains(startElement) ||
            startElement === englishSentenceRef.current);

        if (!isStartInParagraph) return;

        const paragraphText = englishSentenceRef.current.textContent?.trim() || '';
        if (selectedTextContent === paragraphText || paragraphText.includes(selectedTextContent)) {
          setSelectedText(selectedTextContent);
        }
      }, 300);
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

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
            src={`${CDN_ORIGIN}/correct${imageVariant}.webp`}
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
                const tweetText = `【英語きわめ太郎】単語並び替えコースで${correctStreak}問連続正解しました！`;
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
                window.open(twitterUrl, '_blank', 'width=550,height=420');
              }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-[var(--share-button-bg)] px-6 py-3 text-base font-semibold text-[var(--share-button-text)] shadow-lg shadow-[var(--share-button-shadow)]/50 enabled:hover:bg-[var(--share-button-hover)]"
            >
              𝕏 で自慢する
            </button>
          )}
        </div>
        <p
          ref={englishSentenceRef}
          className="py-4 text-2xl font-semibold text-[var(--text)] leading-relaxed select-text cursor-text"
        >
          {problem.englishSentence}
        </p>
        {selectedText && (
          <div className="mb-4">
            <a
              href={`https://www.deepl.com/translator#en/ja/${encodeURIComponent(selectedText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--border)] bg-[var(--background)] pl-3 pr-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 hover:border-[var(--secondary)] hover:text-[var(--secondary)]"
            >
              「{selectedText}」を DeepL で翻訳する
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
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

// ─── Incorrect ───────────────────────────────────────────────────────────────

type IncorrectViewProps = {
  onRetry: () => void;
};

function IncorrectView({ onRetry }: IncorrectViewProps) {
  const [imageVariant] = useState(() => Math.floor(Math.random() * 2) + 1);

  return (
    <section className="grid gap-4 text-center w-[500px] max-w-full mx-auto pt-4">
      <div className="px-6 py-6 text-[var(--error-dark)]">
        <h2 className="text-4xl font-bold pl-4">残念…</h2>
        <div className="mt-6 flex justify-center max-w-[30%] sm:max-w-[120px] mx-auto">
          <Image
            src={`${CDN_ORIGIN}/incorrect${imageVariant}.webp`}
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

// ─── GiveUp ──────────────────────────────────────────────────────────────────

type GiveUpViewProps = {
  sortProblem: WordSortProblemData;
  onNextProblem: () => void;
};

function GiveUpView({ sortProblem, onNextProblem }: GiveUpViewProps) {
  const [imageVariant] = useState(() => Math.floor(Math.random() * 2) + 1);

  const correctSentence = sortProblem.correctSlots
    .map((s) => (s.kind === 'word' ? s.word : s.punctuation))
    .join(' ')
    .replace(/ ([,;:!?.]+)/g, '$1');

  return (
    <section className="grid gap-4 text-center w-[500px] max-w-full mx-auto pt-4">
      <div className="px-6 py-6 text-[var(--error-dark)]">
        <h2 className="text-4xl font-bold pl-4">残念…</h2>
        <div className="mt-6 flex justify-center max-w-[30%] sm:max-w-[120px] mx-auto">
          <Image
            src={`${CDN_ORIGIN}/incorrect${imageVariant}.webp`}
            alt="ショックな様子"
            width={500}
            height={750}
            unoptimized
            priority
          />
        </div>
        <div className="mt-6 text-2xl text-[var(--text)] leading-relaxed font-bold">
          <p className="mb-2">正解は…</p>
          <p>{correctSentence}</p>
        </div>
      </div>
      <div className="flex justify-center">
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
