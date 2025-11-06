'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useLocalStorage } from '@/hooks/useLocalStorage';

type ModeSwitchesProps = {
  className?: string;
};

export function ModeSwitches({ className = '' }: ModeSwitchesProps) {
  // useLocalStorageフックで設定を管理（自動的にタブ間同期される）
  const [isEnglishMode, setIsEnglishMode] = useLocalStorage('englishMode', false);
  const [isNoImageMode, setIsNoImageMode] = useLocalStorage('noImageMode', false);

  const [hasEnglishInteraction, setHasEnglishInteraction] = useState(false);
  const [hasNoImageInteraction, setHasNoImageInteraction] = useState(false);
  const [hasDarkModeInteraction, setHasDarkModeInteraction] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const containerClassName = ['flex w-full flex-col items-start gap-4', className]
    .filter(Boolean)
    .join(' ');

  const isJapaneseAudioEnabled = !isEnglishMode;
  const isImageEnabled = !isNoImageMode;
  const englishModeLabel = `日本語音声${isJapaneseAudioEnabled ? 'あり' : 'なし'}`;
  const imageModeLabel = `画像${isImageEnabled ? 'あり' : 'なし'}`;
  const darkModeLabel = `ダークテーマ${isDarkMode ? 'ON' : 'OFF'}`;

  const toggleEnglishMode = () => {
    const next = !isEnglishMode;
    setHasEnglishInteraction(true);
    setIsEnglishMode(next);
  };

  const toggleNoImageMode = () => {
    const next = !isNoImageMode;
    setHasNoImageInteraction(true);
    setIsNoImageMode(next);
  };

  const toggleDarkMode = () => {
    setHasDarkModeInteraction(true);
    setTheme(isDarkMode ? 'light' : 'dark');
  };

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
