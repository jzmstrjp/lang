'use client';

import { useEffect } from 'react';

export function ThemeColorMeta() {
  useEffect(() => {
    const updateThemeColor = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const themeColor = isDark ? '#0f4c59' : '#ffffff';
      
      // theme-colorメタタグを更新
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute('content', themeColor);
    };

    // 初期設定
    updateThemeColor();

    // data-theme属性の変更を監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateThemeColor();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

