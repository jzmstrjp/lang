'use client';

import { useEffect, useState } from 'react';

type ModeSwitchesProps = {
  className?: string;
};

const STORAGE_KEYS = {
  english: 'englishMode',
  noImage: 'noImageMode',
} as const;

export function ModeSwitches({ className = '' }: ModeSwitchesProps) {
  const [isEnglishMode, setIsEnglishMode] = useState(false);
  const [isNoImageMode, setIsNoImageMode] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasEnglishInteraction, setHasEnglishInteraction] = useState(false);
  const [hasNoImageInteraction, setHasNoImageInteraction] = useState(false);

  useEffect(() => {
    const syncModes = () => {
      const savedEnglishMode = localStorage.getItem(STORAGE_KEYS.english);
      const savedNoImageMode = localStorage.getItem(STORAGE_KEYS.noImage);

      setIsEnglishMode(savedEnglishMode === 'true');
      setIsNoImageMode(savedNoImageMode === 'true');
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

  const toggleEnglishMode = () => {
    const next = !isEnglishMode;
    setIsEnglishMode(next);
    setHasEnglishInteraction(true);
    localStorage.setItem(STORAGE_KEYS.english, next.toString());
  };

  const toggleNoImageMode = () => {
    const next = !isNoImageMode;
    setIsNoImageMode(next);
    setHasNoImageInteraction(true);
    localStorage.setItem(STORAGE_KEYS.noImage, next.toString());
  };

  if (!isReady) {
    return (
      <div
        className={`${containerClassName} opacity-0 pointer-events-none select-none`}
        aria-hidden="true"
      >
        <div className="h-6 w-11 rounded-full bg-[#d8cbb6]" />
        <div className="h-6 w-11 rounded-full bg-[#d8cbb6]" />
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
          } ${isEnglishMode ? 'bg-[#2f8f9d]' : 'bg-[#d8cbb6]'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white ${
              hasEnglishInteraction ? 'transition-transform duration-200' : ''
            } ${isEnglishMode ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>

        <div className="flex flex-col">
          <span className="font-bold transition-opacity">日本語音声なし</span>
        </div>
      </div>

      <div onClick={toggleNoImageMode} className="cursor-pointer flex items-center justify-start">
        <button
          type="button"
          className={`mr-3 relative inline-flex h-6 w-11 items-center rounded-full ${
            hasNoImageInteraction ? 'transition-colors duration-200' : ''
          } ${isNoImageMode ? 'bg-[#2f8f9d]' : 'bg-[#d8cbb6]'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white ${
              hasNoImageInteraction ? 'transition-transform duration-200' : ''
            } ${isNoImageMode ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>

        <div className="flex flex-col">
          <span className="font-bold transition-opacity">画像なし</span>
        </div>
      </div>
    </div>
  );
}

export default ModeSwitches;
