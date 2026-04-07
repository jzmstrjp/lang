import Link from 'next/link';
import { HeaderPortal } from '@/components/layout/header-portal';
import { DIFFICULTY_LEVEL_RULES } from '@/config/problem';
import type { DifficultyLevel } from '@/config/problem';

const LEVELS: { level: DifficultyLevel; description: string }[] = [
  { level: 'kids', description: '子ども向け' },
  { level: 'non_kids', description: 'おとな向け' },
];

export default function FillBlankPage() {
  return (
    <>
      <HeaderPortal>ana-ume</HeaderPortal>
      <div className="mx-auto flex flex-col items-center justify-center gap-4 sm:gap-6 text-[var(--text)]">
        <h1 className="text-2xl font-bold">単語穴埋め</h1>
        <nav className="grid w-full grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-lg">
          {LEVELS.map(({ level, description }) => {
            const displayName = DIFFICULTY_LEVEL_RULES[level].displayName;
            return (
              <Link
                key={level}
                href={`/ana-ume/level/${level}`}
                className="flex w-full flex-col gap-2 items-center rounded-2xl border px-5 py-6 shadow-sm shadow-[var(--border)]/40 transition border-[var(--course-link-outlined-border)] bg-[var(--course-link-outlined-bg)] text-[var(--course-link-outlined-text)] hover:border-[var(--course-link-outlined-hover-border)] hover:bg-[var(--course-link-outlined-hover-bg)] hover:text-[var(--course-link-outlined-hover-text)]"
              >
                <span className="text-2xl sm:text-xl font-semibold">{displayName}</span>
                <span className="text-sm font-medium text-[var(--course-link-outlined-secondary-text)]">
                  {description}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
