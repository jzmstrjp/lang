import Link from 'next/link';

const links = [
  {
    href: '/problems/short',
    label: 'short',
    description: '超短文で瞬時の反応 (2〜4語)',
  },
  {
    href: '/problems/middle',
    label: 'middle',
    description: 'ひと言添える依頼・意見 (6〜10語)',
  },
  {
    href: '/problems/long',
    label: 'long',
    description: '節をつなぐ長文に挑戦 (11〜15語)',
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col items-center justify-center gap-6 px-4 py-12 text-slate-900 sm:px-6">
      <nav className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        {links.map(({ href, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center rounded-2xl border border-slate-200 px-5 py-4 text-blue-600 shadow-sm transition hover:border-blue-300 hover:text-blue-500"
          >
            <span className="text-lg font-semibold">{label}</span>
            <span className="text-xs font-medium text-slate-500">{description}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
