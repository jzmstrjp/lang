import Link from 'next/link';
import { WORD_COUNT_RULES } from '@/config/problem';

const links = [
  {
    href: '/problems/short',
    label: 'short',
    description: `短い文 (${WORD_COUNT_RULES.short.min}〜${WORD_COUNT_RULES.short.max}語)`,
  },
  {
    href: '/problems/medium',
    label: 'medium',
    description: `中くらいの文 (${WORD_COUNT_RULES.medium.min}〜${WORD_COUNT_RULES.medium.max}語)`,
  },
  {
    href: '/problems/long',
    label: 'long',
    description: `少し長い文 (${WORD_COUNT_RULES.long.min}〜${WORD_COUNT_RULES.long.max}語)`,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col items-center justify-center gap-6 px-4 py-12 text-[#2a2b3c] sm:px-6">
      <nav className="flex w-full flex-col items-stretch gap-4 sm:flex-row sm:gap-6">
        {links.map(({ href, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex w-full flex-col items-center rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition hover:border-[#2f8f9d] hover:text-[#2f8f9d] sm:flex-1"
          >
            <span className="text-lg font-semibold">{label}</span>
            <span className="text-sm font-medium text-[#d77a61]">{description}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
