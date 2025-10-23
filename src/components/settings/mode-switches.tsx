'use client';

import { useEffect, useState } from 'react';

type ModeSwitchesProps = {
  className?: string;
};

const STORAGE_KEYS = {
  english: 'englishMode',
  noImage: 'noImageMode',
  darkMode: 'darkMode',
} as const;

export function ModeSwitches({ className = '' }: ModeSwitchesProps) {
  const [isEnglishMode, setIsEnglishMode] = useState(false);
  const [isNoImageMode, setIsNoImageMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasEnglishInteraction, setHasEnglishInteraction] = useState(false);
  const [hasNoImageInteraction, setHasNoImageInteraction] = useState(false);
  const [hasDarkModeInteraction, setHasDarkModeInteraction] = useState(false);

  useEffect(() => {
    const syncModes = () => {
      const savedEnglishMode = localStorage.getItem(STORAGE_KEYS.english);
      const savedNoImageMode = localStorage.getItem(STORAGE_KEYS.noImage);
      const savedDarkMode = localStorage.getItem(STORAGE_KEYS.darkMode);

      setIsEnglishMode(savedEnglishMode === 'true');
      setIsNoImageMode(savedNoImageMode === 'true');
      setIsDarkMode(savedDarkMode === 'true');

      // ダークモードのテーマを適用
      if (savedDarkMode === 'true') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#1a3d5a');
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
      }
    };

    syncModes();
    setIsReady(true);

    const handleStorageChange = () => {
      syncModes();
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = window.setInterval(syncModes, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.clearInterval(interval);
    };
  }, []);

  const containerClassName = ['flex w-full flex-col items-start gap-4', className]
    .filter(Boolean)
    .join(' ');

  const isJapaneseAudioEnabled = !isEnglishMode;
  const isImageEnabled = !isNoImageMode;
  const englishModeLabel = `日本語音声${isJapaneseAudioEnabled ? 'あり' : 'なし'}`;
  const imageModeLabel = `画像${isImageEnabled ? 'あり' : 'なし'}`;
  const darkModeLabel = `ダークテーマ${isDarkMode ? 'ON' : 'OFF'}`;

  const emitSettingChange = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('problem-setting-change'));
  };

  const toggleEnglishMode = () => {
    const next = !isEnglishMode;
    setIsEnglishMode(next);
    setHasEnglishInteraction(true);
    localStorage.setItem(STORAGE_KEYS.english, next.toString());
    emitSettingChange();
  };

  const toggleNoImageMode = () => {
    const next = !isNoImageMode;
    setIsNoImageMode(next);
    setHasNoImageInteraction(true);
    localStorage.setItem(STORAGE_KEYS.noImage, next.toString());
    emitSettingChange();
  };

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    setHasDarkModeInteraction(true);
    localStorage.setItem(STORAGE_KEYS.darkMode, next.toString());

    // ダークモードのテーマを即座に適用
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    emitSettingChange();
  };

  if (!isReady) {
    return (
      <div
        className={`${containerClassName} opacity-0 pointer-events-none select-none`}
        aria-hidden="true"
      >
        <div className="h-6 w-11 rounded-full bg-[var(--border)]" />
        <div className="h-6 w-11 rounded-full bg-[var(--border)]" />
        <div className="h-6 w-11 rounded-full bg-[var(--border)]" />
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <div onClick={toggleEnglishMode} className="cursor-pointer flex items-center justify-start">
        <button
          type="button"
          className={`mr-3 relative inline-flex h-6 w-11 items-center rounded-full ${
            hasEnglishInteraction ? 'transition-colors duration-200' : ''
          } ${isJapaneseAudioEnabled ? 'bg-[var(--switch-on)]' : 'bg-[var(--switch-off)]'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-[var(--switch-toggle)] ${
              hasEnglishInteraction ? 'transition-transform duration-200' : ''
            } ${isJapaneseAudioEnabled ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>

        <div className="flex flex-col">
          <span className="font-bold transition-opacity">{englishModeLabel}</span>
        </div>
      </div>

      <div onClick={toggleNoImageMode} className="cursor-pointer flex items-center justify-start">
        <button
          type="button"
          className={`mr-3 relative inline-flex h-6 w-11 items-center rounded-full ${
            hasNoImageInteraction ? 'transition-colors duration-200' : ''
          } ${isImageEnabled ? 'bg-[var(--switch-on)]' : 'bg-[var(--switch-off)]'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-[var(--switch-toggle)] ${
              hasNoImageInteraction ? 'transition-transform duration-200' : ''
            } ${isImageEnabled ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>

        <div className="flex flex-col">
          <span className="font-bold transition-opacity">{imageModeLabel}</span>
        </div>
      </div>

      <div onClick={toggleDarkMode} className="cursor-pointer flex items-center justify-start">
        <button
          type="button"
          className={`mr-3 relative inline-flex h-6 w-11 items-center rounded-full ${
            hasDarkModeInteraction ? 'transition-colors duration-200' : ''
          } ${isDarkMode ? 'bg-[var(--switch-on)]' : 'bg-[var(--switch-off)]'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-[var(--switch-toggle)] ${
              hasDarkModeInteraction ? 'transition-transform duration-200' : ''
            } ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>

        <div className="flex flex-col">
          <span className="font-bold transition-opacity">{darkModeLabel}</span>
        </div>
      </div>
    </div>
  );
}

export default ModeSwitches;
