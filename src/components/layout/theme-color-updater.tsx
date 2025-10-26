'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

export function ThemeColorUpdater() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#1a3d5a' : '#ffffff');
    }
  }, [resolvedTheme]);

  return null;
}
