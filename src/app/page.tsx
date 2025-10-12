import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { WORD_COUNT_RULES } from '@/config/problem';
import { ALLOWED_SHARE_COUNTS } from '@/const';

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

type HomePageProps = {
  searchParams: Promise<{ streak?: string }>;
};

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const awaitedSearchParams = await searchParams;
  const shareCount = awaitedSearchParams.streak;

  // シェアパラメータがある場合は動的OGP
  if (shareCount) {
    const count = parseInt(shareCount, 10);
    if (
      !isNaN(count) &&
      ALLOWED_SHARE_COUNTS.includes(count as (typeof ALLOWED_SHARE_COUNTS)[number])
    ) {
      const title = `【英語きわめ太郎】${count}問連続正解しました！`;
      const description = `【英語きわめ太郎】${count}問連続正解しました！`;
      const ogImageUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/correct-streak-ogp/correct${count}.png`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: 'https://en-ma.ster.jp.net/',
          siteName: '英語きわめ太郎',
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: `${count}問連続正解`,
            },
          ],
          locale: 'ja_JP',
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [ogImageUrl],
        },
      };
    }
  }

  // 通常のメタデータはlayout.tsxから継承
  return {};
}

export default function Home() {
  return (
    <div className="mx-auto flex flex-col items-center justify-center gap-6 lg:pt-10 text-[#2a2b3c]">
      <div className="rounded-2xl overflow-hidden">
        <Image
          src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/top.webp`}
          alt="なぜだかいつのまにか英語が聞き取れるようになるサイト"
          unoptimized
          width={1200}
          height={630}
        />
      </div>
      <nav className="flex w-full flex-col items-stretch gap-4 sm:flex-row sm:gap-6">
        {links.map(({ href, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex w-full flex-col gap-2 items-center rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition hover:border-[#2f8f9d] hover:text-[#2f8f9d] sm:flex-1"
          >
            <span className="text-2xl sm:text-xl font-semibold capitalize">{label}</span>
            <span className="text-sm font-medium text-[#d77a61]">{description}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
