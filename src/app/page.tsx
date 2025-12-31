import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { ALLOWED_SHARE_COUNTS } from '@/const';

const links: { href: string; level?: number; label: string; description: string }[] = [
  // {
  //   href: '/problems/short',
  //   label: 'short',
  //   description: `短い文`,
  // },
  // {
  //   href: '/problems/medium',
  //   label: 'medium',
  //   description: `中くらいの文`,
  // },
  // {
  //   href: '/problems/long',
  //   label: 'long',
  //   description: `少し長い文`,
  // },
  {
    href: '/level/kids',
    level: 1,
    label: 'Kids',
    description: `子ども向け`,
  },
  {
    href: '/level/easy',
    label: 'Easy',
    level: 2,
    description: `かんたん`,
  },
  {
    href: '/level/normal',
    label: 'Normal',
    level: 3,
    description: `ふつう`,
  },
  {
    href: '/level/hard',
    label: 'Hard',
    level: 4,
    description: `むずかしい`,
  },
  {
    href: '/level/expert',
    label: 'Expert',
    level: 5,
    description: `げきむず`,
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
    <div className="mx-auto flex flex-col items-center justify-center gap-4 sm:gap-6 text-[var(--text)]">
      <div className="rounded-2xl overflow-hidden">
        <Image
          src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/top.webp`}
          alt="なぜだかいつのまにか英語が聞き取れるようになるサイト"
          unoptimized
          priority
          width={1200}
          height={630}
        />
      </div>
      <nav className="flex w-full flex-col items-stretch gap-4 sm:flex-row sm:gap-6">
        {links.map(({ href, level, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex w-full flex-col gap-2 items-center rounded-2xl border border-[var(--course-link-border)] bg-[var(--course-link-bg)] px-5 py-4 text-[var(--course-link-text)] shadow-sm shadow-[var(--border)]/40 transition hover:border-[var(--course-link-hover-border)] hover:bg-[var(--course-link-hover-bg)] hover:text-[var(--course-link-hover-text)] sm:flex-1"
          >
            <span className="text-2xl sm:text-xl font-semibold capitalize">{label}</span>
            {level && (
              <span className="text-sm font-medium text-[var(--course-link-secondary-text)]">
                {'★'.repeat(level)}
              </span>
            )}
            <span className="text-sm font-medium text-[var(--course-link-secondary-text)]">
              {description}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
