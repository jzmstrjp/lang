import Link from "next/link";

const links = [
  { href: "/problems/short", label: "short" },
  { href: "/problems/middle", label: "middle" },
  { href: "/problems/long", label: "long" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col items-center justify-center gap-6 px-4 py-12 text-slate-900 sm:px-6">
      <nav className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-lg font-semibold text-blue-600 transition hover:text-blue-500"
          >
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
