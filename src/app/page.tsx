'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
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
  const [isEnglishMode, setIsEnglishMode] = useState(false);

  // localStorageから設定を読み込み
  useEffect(() => {
    const savedMode = localStorage.getItem('englishMode');
    if (savedMode === 'true') {
      setIsEnglishMode(true);
    }
  }, []);

  // 設定変更時にlocalStorageに保存
  const toggleEnglishMode = () => {
    const newMode = !isEnglishMode;
    setIsEnglishMode(newMode);
    localStorage.setItem('englishMode', newMode.toString());
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col items-center justify-center gap-6 px-4 py-12 text-[#2a2b3c] sm:px-6">
      <p className="text-center font-bold mb-4 text-2xl">なぜだか<br />いつのまにか<br />英語が聞き取れる<br />ようになるサイト</p>
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

      {/* 完全英語モード切り替えスイッチ */}
      <div
        onClick={toggleEnglishMode}
        className="cursor-pointer flex items-center justify-start mt-4"
      >
        <div className="flex flex-col mr-2">
          <span className="font-bold transition-opacity">完全英語モード</span>
        </div>

        <button
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isEnglishMode ? 'bg-[#2f8f9d]' : 'bg-[#d8cbb6]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              isEnglishMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </main>
  );
}
