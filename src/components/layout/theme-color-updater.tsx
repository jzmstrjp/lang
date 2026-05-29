'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

const LIGHT_THEME_COLOR = '#d4e6ea';
const DARK_THEME_COLOR = '#1a3d5a';

function resolveThemeColor(resolvedTheme: string | undefined): string {
  if (resolvedTheme === 'dark') return DARK_THEME_COLOR;
  if (resolvedTheme === 'light') return LIGHT_THEME_COLOR;

  const fromCss = getComputedStyle(document.documentElement)
    .getPropertyValue('--safe-top-color')
    .trim();
  return fromCss || LIGHT_THEME_COLOR;
}

export function ThemeColorUpdater() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = resolveThemeColor(resolvedTheme);
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', color);
    });
  }, [resolvedTheme]);

  return null;
}
