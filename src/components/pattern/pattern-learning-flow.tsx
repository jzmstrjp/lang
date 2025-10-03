'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StartButton } from '@/components/ui/start-button';

type PatternExample = {
  id: string;
  order: number;
  englishSentence: string;
  japaneseSentence: string;
  japaneseReply: string;
  place: string;
  senderRole: string;
  receiverRole: string;
  senderVoice: 'male' | 'female';
  receiverVoice: 'male' | 'female';
  audioEnUrl: string;
  audioJaUrl: string;
  imageUrl: string;
};

type PatternSet = {
  id: string;
  patternName: string;
  patternMeaning: string;
  patternDescription: string;
  examples: PatternExample[];
  testProblem: {
    questionPattern: string;
    correctAnswer: string;
    incorrectOptions: string[];
  };
  additionalExamples: Array<{
    english: string;
    japanese: string;
  }>;
};

type PatternLearningFlowProps = {
  patternSet: PatternSet;
  onNextPattern: () => void;
};

type Phase = 'landing' | 'examples' | 'test' | 'result';

export default function PatternLearningFlow({
  patternSet,
  onNextPattern,
}: PatternLearningFlowProps) {
  const [phase, setPhase] = useState<Phase>('landing');
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'playing'>('idle');
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);

  const currentExample = patternSet.examples[currentExampleIndex];
  const isLastExample = currentExampleIndex === patternSet.examples.length - 1;
  const isAudioBusy = audioStatus !== 'idle';

  // 音声再生用のref
  const englishAudioRef = useRef<HTMLAudioElement | null>(null);
  const japaneseAudioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = useCallback((audio: HTMLAudioElement | null, delay: number = 0) => {
    if (!audio) return;

    setAudioStatus('playing');
    setTimeout(() => {
      audio.currentTime = 0;
      audio.play().catch(() => {
        console.warn('音声の再生に失敗しました。');
        setAudioStatus('idle');
      });
    }, delay);
  }, []);

  // 例文の音声を順次再生
  const playExampleSequence = useCallback(() => {
    if (!currentExample) return;

    // 英語文を再生
    playAudio(englishAudioRef.current, 100);
  }, [currentExample, playAudio]);

  // 英語文の再生が終わったら日本語返答を再生
  const handleEnglishAudioEnded = useCallback(() => {
    // 英語文が終わってもidleにしない（日本語返答が続くため）
    setTimeout(() => {
      playAudio(japaneseAudioRef.current, 100);
    }, 200);
  }, [playAudio]);

  // 日本語返答の再生が終わったらidleにする
  const handleJapaneseAudioEnded = useCallback(() => {
    setAudioStatus('idle');
  }, []);

  // クイズ画面で1つ目の音声を再生
  const playQuizAudio = useCallback(() => {
    if (patternSet.examples[0]) {
      setAudioStatus('playing');
      const audio = new Audio(patternSet.examples[0].audioEnUrl);
      audio.onended = () => setAudioStatus('idle');
      audio.play().catch(() => {
        console.warn('音声の再生に失敗しました。');
        setAudioStatus('idle');
      });
    }
  }, [patternSet.examples]);

  // 正解画面で2つ目の音声を再生
  const playResultAudio = useCallback(() => {
    if (patternSet.examples[1]) {
      setAudioStatus('playing');
      const audio = new Audio(patternSet.examples[1].audioEnUrl);
      audio.onended = () => setAudioStatus('idle');
      audio.play().catch(() => {
        console.warn('音声の再生に失敗しました。');
        setAudioStatus('idle');
      });
    }
  }, [patternSet.examples]);

  // 例文表示開始時に音声を再生
  useEffect(() => {
    if (phase === 'examples') {
      playExampleSequence();
    }
  }, [phase, currentExampleIndex, playExampleSequence]);

  // クイズ画面に遷移したら1枚目の音声を再生
  useEffect(() => {
    if (phase === 'test') {
      playQuizAudio();
    }
  }, [phase, playQuizAudio]);

  // 正解画面に遷移したら2枚目の音声を再生
  useEffect(() => {
    if (phase === 'result' && isCorrect) {
      playResultAudio();
    }
  }, [phase, isCorrect, playResultAudio]);

  // 次の例文へ進む
  const handleNextExample = () => {
    if (isLastExample) {
      setPhase('test');
    } else {
      setCurrentExampleIndex((prev) => prev + 1);
    }
  };

  // テスト問題の選択肢をシャッフル（初回マウント時のみ）
  useEffect(() => {
    const allOptions = [
      patternSet.testProblem.correctAnswer,
      ...patternSet.testProblem.incorrectOptions,
    ];
    const shuffled = [...allOptions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledOptions(shuffled);
  }, [patternSet]);

  const correctAnswerIndex = shuffledOptions.findIndex(
    (option) => option === patternSet.testProblem.correctAnswer,
  );

  const handleTestAnswer = (selectedIndex: number) => {
    const correct = selectedIndex === correctAnswerIndex;
    setIsCorrect(correct);
    setPhase('result');
  };

  const handleStart = () => {
    setPhase('examples');
  };

  const handleNextPattern = () => {
    // 状態をリセット
    setPhase('examples');
    setCurrentExampleIndex(0);
    setIsCorrect(null);
    setAudioStatus('idle');
    onNextPattern();
  };

  // 例文に戻る
  const handleBackToExamples = () => {
    setPhase('examples');
    setCurrentExampleIndex(0);
    setAudioStatus('idle');
  };

  return (
    <>
      {phase === 'landing' && (
        <StartButton error={null} handleStart={handleStart}>
          パターン学習を始める
        </StartButton>
      )}
      <div className="max-w-4xl mx-auto">
        {/* 例文表示フェーズ */}
        {phase === 'examples' && currentExample && (
          <div className="relative max-w-[500px] mx-auto">
            {/* 画像表示 */}
            <Image
              src={currentExample.imageUrl}
              alt={`${currentExample.place}での会話シーン`}
              width={500}
              height={750}
              className={`w-full h-auto object-contain ${
                !isAudioBusy ? 'opacity-50' : 'opacity-100'
              }`}
              priority
              unoptimized
            />

            {/* 次の例文へボタン（画像の中心に配置） */}
            {!isAudioBusy && (
              <div className="absolute inset-0 flex items-center justify-center">
                {isLastExample ? (
                  <button
                    onClick={handleNextExample}
                    className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#c3684f]"
                  >
                    クイズへ
                  </button>
                ) : (
                  <button
                    onClick={handleNextExample}
                    className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition hover:border-[#d77a61] hover:text-[#d77a61]"
                  >
                    次へ
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* テストフェーズ */}
        {phase === 'test' && (
          <section className="grid gap-8">
            <div>
              <p className="text-xl font-semibold text-[#2a2b3c] sm:text-2xl mb-2">
                {patternSet.patternName}
              </p>
              <p className="text-base text-[#2a2b3c]/70">の意味はどれでしょう？</p>
            </div>
            <ul className="grid gap-3">
              {shuffledOptions.map((option, index) => (
                <li key={index}>
                  <button
                    onClick={() => handleTestAnswer(index)}
                    disabled={isAudioBusy}
                    className="w-full rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-left text-base font-medium text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#2f8f9d] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d] disabled:opacity-50"
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-center">
              <button
                onClick={handleBackToExamples}
                disabled={isAudioBusy}
                className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:opacity-60"
              >
                例文に戻る
              </button>
            </div>
          </section>
        )}

        {/* 結果フェーズ */}
        {phase === 'result' && (
          <section className="grid gap-6 text-center">
            <div
              className={`rounded-3xl border px-6 py-10 shadow-lg shadow-slate-900/10 ${
                isCorrect
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              <h2 className="text-2xl font-bold">
                {isCorrect ? 'やった！ 正解です 🎉' : '残念…もう一度挑戦してみましょう'}
              </h2>
              {isCorrect && (
                <>
                  <p className="mt-4 text-2xl font-semibold text-[#2a2b3c]">
                    {patternSet.patternName}
                  </p>
                  <p className="mt-4 text-lg text-[#2a2b3c]">{patternSet.patternMeaning}</p>
                </>
              )}
            </div>
            <div className="flex flex-row gap-3 items-center justify-center">
              {isCorrect ? (
                <button
                  onClick={handleNextPattern}
                  disabled={isAudioBusy}
                  className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 transition enabled:hover:bg-[#c3684f] disabled:opacity-60"
                >
                  次のパターンに挑戦
                </button>
              ) : (
                <button
                  onClick={handleBackToExamples}
                  disabled={isAudioBusy}
                  className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:opacity-60"
                >
                  再挑戦
                </button>
              )}
            </div>
          </section>
        )}

        {/* 音声要素 */}
        {currentExample && (
          <>
            <audio
              ref={englishAudioRef}
              src={currentExample.audioEnUrl}
              preload="auto"
              onEnded={handleEnglishAudioEnded}
            />
            <audio
              ref={japaneseAudioRef}
              src={currentExample.audioJaUrl}
              preload="auto"
              onEnded={handleJapaneseAudioEnded}
            />
          </>
        )}
      </div>
    </>
  );
}
