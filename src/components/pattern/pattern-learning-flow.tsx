'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StartButton } from '@/components/ui/start-button';
import { shuffleOptionsWithCorrectIndex } from '@/lib/shuffle-utils';

// バックエンドのpattern-service.tsの型をインポート
import type { PatternSetWithDetails } from '@/lib/pattern-service';

type PatternLearningFlowProps = {
  initialPatternSet: PatternSetWithDetails;
};

type Phase = 'landing' | 'examples' | 'test' | 'result';

export default function PatternLearningFlow({ initialPatternSet }: PatternLearningFlowProps) {
  const [patternSet, setPatternSet] = useState(initialPatternSet);
  const [nextPatternSet, setNextPatternSet] = useState<PatternSetWithDetails | null>(null);
  const [phase, setPhase] = useState<Phase>('landing');
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'playing'>('idle');
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);

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

  // 次のパターンを事前fetch（1問目が始まったタイミング）
  useEffect(() => {
    if (phase === 'examples' && !nextPatternSet) {
      // 例文フェーズに入ったら次のパターンを事前fetch
      fetch('/api/pattern-learning')
        .then((res) => res.json())
        .then((data) => setNextPatternSet(data))
        .catch((error) => console.error('次のパターンセットの事前取得に失敗:', error));
    }
  }, [phase, nextPatternSet]);

  // 次の例文へ進む
  const handleNextExample = () => {
    if (isLastExample) {
      setPhase('test');
    } else {
      setCurrentExampleIndex((prev) => prev + 1);
    }
  };

  // テスト問題の選択肢をシャッフル（パターンセット変更時）
  useEffect(() => {
    const incorrectOptions = Array.isArray(patternSet.incorrectOptions)
      ? (patternSet.incorrectOptions as string[])
      : [];

    const { options, correctIndex: newCorrectIndex } = shuffleOptionsWithCorrectIndex(
      patternSet.correctAnswer,
      incorrectOptions,
    );

    setShuffledOptions(options);
    setCorrectIndex(newCorrectIndex);
  }, [patternSet]);

  const handleTestAnswer = (selectedIndex: number) => {
    const correct = selectedIndex === correctIndex;
    setIsCorrect(correct);
    setPhase('result');
  };

  const handleStart = () => {
    setPhase('examples');
  };

  const handleNextPattern = async () => {
    // 事前fetchしたパターンセットがあればそれを使用、なければAPIから取得
    if (nextPatternSet) {
      setPatternSet(nextPatternSet);
      setNextPatternSet(null); // 使い終わったのでクリア
      // 状態をリセット（landingではなく直接examplesへ）
      setPhase('examples');
      setCurrentExampleIndex(0);
      setIsCorrect(null);
      setAudioStatus('idle');
    } else {
      // フォールバック: 事前fetchが失敗していた場合
      try {
        const response = await fetch('/api/pattern-learning');
        if (response.ok) {
          const newPatternSet = await response.json();
          setPatternSet(newPatternSet);
          // 状態をリセット（landingではなく直接examplesへ）
          setPhase('examples');
          setCurrentExampleIndex(0);
          setIsCorrect(null);
          setAudioStatus('idle');
        }
      } catch (error) {
        console.error('パターンセットの取得に失敗しました:', error);
      }
    }
  };

  // 例文に戻る
  const handleBackToExamples = () => {
    setPhase('examples');
    setCurrentExampleIndex(0);
    setAudioStatus('idle');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* ランディングフェーズ */}
      {phase === 'landing' && (
        <div className="relative max-w-[500px] mx-auto">
          {/* 1枚目の画像表示 */}
          <Image
            src={patternSet.examples[0].imageUrl}
            alt={`${patternSet.examples[0].place}での会話シーン`}
            width={500}
            height={750}
            className="w-full h-auto object-contain opacity-50"
            priority
            unoptimized
          />

          <div className="absolute inset-0 flex items-center justify-center">
            <StartButton error={null} handleStart={handleStart}>
              始める
            </StartButton>
          </div>
        </div>
      )}
      {phase !== 'landing' && (
        <div>
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
              <div className="flex items-baseline">
                <p className="text-xl font-semibold text-[#2a2b3c] sm:text-2xl">
                  「 {patternSet.patternName} 」
                </p>
                <p className="font-semibold text-[#2a2b3c]/70">の意味は？</p>
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
                    <p className="mt-4 text-lg text-[#2a2b3c]">{patternSet.correctAnswer}</p>
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
      )}
    </div>
  );
}
