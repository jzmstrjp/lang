import Link from 'next/link';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { HEADER_PORTAL_ID } from '@/components/layout/header-portal-id';
import { SettingsMenu } from '@/components/settings/settings-menu';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '英語きわめ太郎',
  description: 'いつの間にか、なぜだか英語が聞き取れるようになるサイト',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: '英語きわめ太郎',
    description: 'いつの間にか、なぜだか英語が聞き取れるようになるサイト',
    url: 'https://en-ma.ster.jp.net/',
    siteName: '英語きわめ太郎',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/ogp.png`,
        width: 1200,
        height: 630,
        alt: '英語きわめ太郎 - 英語学習アプリ',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '英語きわめ太郎',
    description: 'いつの間にか、なぜだか英語が聞き取れるようになるサイト',
    images: [`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/ogp.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[var(--background)] text-[var(--text)] antialiased`}
        suppressHydrationWarning
      >
        <header className="border-[var(--header-border)] lg:bg-transparent lg:h-0">
          <div className="mx-auto flex h-12 sm:h-14 w-full items-center pl-4 pr-2 sm:px-6">
            <div className="flex flex-1 items-center gap-2">
              <Link
                href="/"
                className="text-lg font-bold tracking-wide text-[var(--text-black)] flex gap-2"
              >
                英語きわめ太郎
                <span
                  id={HEADER_PORTAL_ID}
                  className="flex-1 truncate text-lg font-bold capitalize"
                  aria-live="polite"
                />
              </Link>
            </div>
            <SettingsMenu className="ml-4" />
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-16 pt-0 lg:pt-4 font-sans text-[var(--text)] sm:px-6 lg:max-w-4xl">
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  );
}
