import Link from 'next/link';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SettingsMenu } from '@/components/settings/settings-menu';
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
        url: 'https://pub-995972d9b52a40d4be0d9e9de6195f51.r2.dev/ogp.png',
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
    images: ['https://pub-995972d9b52a40d4be0d9e9de6195f51.r2.dev/ogp.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-white text-slate-900 antialiased`}
        suppressHydrationWarning
      >
        <header className="border-b border-gray-800 bg-black">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center pl-4 pr-2 sm:px-6">
            <Link href="/" className="text-lg font-bold tracking-wide text-white">
              英語きわめ太郎
            </Link>
            <SettingsMenu className="ml-auto" />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
