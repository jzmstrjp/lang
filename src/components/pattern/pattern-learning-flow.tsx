'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SceneImage } from '@/components/ui/scene-image';
import { StartButton } from '@/components/ui/start-button';
import { shuffleOptionsWithCorrectIndex } from '@/lib/shuffle-utils';

// バックエンドのpattern-service.tsの型をインポート
import type { PatternSetWithDetails } from '@/lib/pattern-service';

type PatternLearningFlowProps = {
  initialPatternSet: PatternSetWithDetails;
};

// フェーズの定義
// landing: スタート画面
// example-audio: 例文の音声を聞いている
// example-quiz: 例文の意味を4択で答える
// example-correct: 例文クイズ正解
// example-incorrect: 例文クイズ不正解
// final-quiz: 最終クイズ（パターン全体の意味を問う）
// final-result: 最終結果
type Phase =
  | 'landing'
  | 'example-audio'
  | 'example-quiz'
  | 'example-correct'
  | 'example-incorrect'
  | 'final-quiz'
  | 'final-result';

export default function PatternLearningFlow({ initialPatternSet }: PatternLearningFlowProps) {
  const [patternSet, setPatternSet] = useState(initialPatternSet);
  const [nextPatternSet, setNextPatternSet] = useState<PatternSetWithDetails | null>(null);
  const [phase, setPhase] = useState<Phase>('landing');
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0); // 0, 1, 2 (3問)
  const [audioStatus, setAudioStatus] = useState<'idle' | 'playing'>('idle');

  // 各例文クイズの選択肢（シャッフル済み）
  const [exampleQuizOptions, setExampleQuizOptions] = useState<string[]>([]);
  const [exampleQuizCorrectIndex, setExampleQuizCorrectIndex] = useState(0);

  // 最終クイズの選択肢（シャッフル済み）
  const [finalQuizOptions, setFinalQuizOptions] = useState<string[]>([]);
  const [finalQuizCorrectIndex, setFinalQuizCorrectIndex] = useState(0);

  // 最終クイズの正解・不正解
  const [isFinalQuizCorrect, setIsFinalQuizCorrect] = useState<boolean | null>(null);

  const currentExample = patternSet.examples[currentExampleIndex];
  const isLastExample = currentExampleIndex === patternSet.examples.length - 1; // 2番目（3問目）
  const isAudioBusy = audioStatus !== 'idle';

  // 音声再生用のref
  const englishAudioRef = useRef<HTMLAudioElement | null>(null);
  const japaneseAudioRef = useRef<HTMLAudioElement | null>(null);
  const finalQuizAudioRef = useRef<HTMLAudioElement | null>(null);
  const finalResultAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // 例文の音声を順次再生（英語 → 日本語）
  const playExampleAudioSequence = useCallback(() => {
    if (!currentExample) return;
    playAudio(englishAudioRef.current, 100);
  }, [currentExample, playAudio]);

  // 英語文の再生が終わったときの処理
  const handleEnglishAudioEnded = useCallback(() => {
    // example-audioフェーズの場合のみ、日本語返答を続けて再生
    if (phase === 'example-audio') {
      setTimeout(() => {
        playAudio(japaneseAudioRef.current, 100);
      }, 200);
    } else {
      // example-correctなど他のフェーズでは、英語文だけで終了
      setAudioStatus('idle');
    }
  }, [phase, playAudio]);

  // 日本語返答の再生が終わったら、英語文を再生してから例文クイズに遷移
  const handleJapaneseAudioEnded = useCallback(() => {
    // クイズ画面で英語文を再生（ユーザーイベントの連鎖として扱われる）
    if (englishAudioRef.current) {
      setAudioStatus('playing');
      englishAudioRef.current.currentTime = 0;
      englishAudioRef.current.play().catch(() => {
        console.warn('クイズ画面での音声再生に失敗しました。');
        setAudioStatus('idle');
      });
    }

    setTimeout(() => {
      setPhase('example-quiz');
    }, 200);
  }, []);

  // 例文音声フェーズ開始時に音声を再生
  useEffect(() => {
    if (phase === 'example-audio') {
      setTimeout(() => {
        playExampleAudioSequence();
      }, 100);
    }
  }, [phase, currentExampleIndex, playExampleAudioSequence]);

  // 最終クイズ画面に遷移したら1枚目の音声を再生
  useEffect(() => {
    if (phase === 'final-quiz') {
      setTimeout(() => {
        playAudio(finalQuizAudioRef.current, 0);
      }, 0);
    }
  }, [phase, playAudio]);

  // 最終結果画面（正解時）に遷移したら2枚目の音声を再生
  useEffect(() => {
    if (phase === 'final-result' && isFinalQuizCorrect) {
      setTimeout(() => {
        playAudio(finalResultAudioRef.current, 0);
      }, 0);
    }
  }, [phase, isFinalQuizCorrect, playAudio]);

  // 次のパターンを事前fetch（1問目が始まったタイミング）
  useEffect(() => {
    if (phase === 'example-audio' && currentExampleIndex === 0 && !nextPatternSet) {
      fetch('/api/pattern-learning')
        .then((res) => res.json())
        .then((data) => setNextPatternSet(data))
        .catch((error) => console.error('次のパターンセットの事前取得に失敗:', error));
    }
  }, [phase, currentExampleIndex, nextPatternSet]);

  // 現在の例文クイズの選択肢をシャッフル（例文が変わったとき）
  useEffect(() => {
    if (!currentExample) return;

    const incorrectOptions = Array.isArray(currentExample.incorrectOptions)
      ? currentExample.incorrectOptions
      : [];

    const { options, correctIndex: newCorrectIndex } = shuffleOptionsWithCorrectIndex(
      currentExample.japaneseSentence,
      incorrectOptions,
    );

    setExampleQuizOptions(options);
    setExampleQuizCorrectIndex(newCorrectIndex);
  }, [currentExample]);

  // 最終クイズの選択肢をシャッフル（パターンセット変更時）
  useEffect(() => {
    const incorrectOptions = Array.isArray(patternSet.incorrectOptions)
      ? (patternSet.incorrectOptions as string[])
      : [];

    const { options, correctIndex: newCorrectIndex } = shuffleOptionsWithCorrectIndex(
      patternSet.correctAnswer,
      incorrectOptions,
    );

    setFinalQuizOptions(options);
    setFinalQuizCorrectIndex(newCorrectIndex);
  }, [patternSet]);

  // ハンドラー: スタートボタン
  const handleStart = () => {
    setTimeout(() => {
      setPhase('example-audio');
    }, 0);
  };

  // ハンドラー: 例文クイズの回答
  const handleExampleQuizAnswer = (selectedIndex: number) => {
    const correct = selectedIndex === exampleQuizCorrectIndex;

    if (correct) {
      setTimeout(() => {
        // 正解の場合、englishSentenceを再生しながら正解画面を表示
        setPhase('example-correct');
        playAudio(englishAudioRef.current, 0);

        // 最後の例文なら、少し待ってから最終クイズへ自動遷移
        if (isLastExample) {
          setTimeout(() => {
            setPhase('final-quiz');
          }, 2000);
        }
      }, 0);
    } else {
      setTimeout(() => {
        // 不正解の場合
        setPhase('example-incorrect');
      }, 0);
    }
  };

  // ハンドラー: 例文クイズ正解後、次の例文へ
  const handleGoToNextExample = () => {
    setTimeout(() => {
      setCurrentExampleIndex((prev) => prev + 1);
      setPhase('example-audio');
    }, 0);
  };

  // ハンドラー: 例文クイズ不正解、同じ例文をもう一度
  const handleRetryCurrentExample = () => {
    setTimeout(() => {
      setPhase('example-audio');
    }, 0);
  };

  // ハンドラー: 最終クイズの回答
  const handleFinalQuizAnswer = (selectedIndex: number) => {
    setTimeout(() => {
      const correct = selectedIndex === finalQuizCorrectIndex;
      setIsFinalQuizCorrect(correct);
      setPhase('final-result');
    }, 0);
  };

  // ハンドラー: 最終クイズ不正解、1問目からやり直し
  const handleRetryFromStart = () => {
    setTimeout(() => {
      setCurrentExampleIndex(0);
      setIsFinalQuizCorrect(null);
      setPhase('example-audio');
    }, 0);
  };

  // ハンドラー: 次のパターンに挑戦
  const handleNextPattern = async () => {
    if (nextPatternSet) {
      setTimeout(() => {
        setPatternSet(nextPatternSet);
        setNextPatternSet(null);
        setCurrentExampleIndex(0);
        setIsFinalQuizCorrect(null);
        setAudioStatus('idle');
        setPhase('example-audio');
      }, 0);
    } else {
      // フォールバック
      try {
        const response = await fetch('/api/pattern-learning');
        if (response.ok) {
          const newPatternSet = await response.json();
          setTimeout(() => {
            setPatternSet(newPatternSet);
            setCurrentExampleIndex(0);
            setIsFinalQuizCorrect(null);
            setAudioStatus('idle');
            setPhase('example-audio');
          }, 0);
        }
      } catch (error) {
        console.error('パターンセットの取得に失敗しました:', error);
      }
    }
  };

  // ハンドラー: もう一度聞く（例文クイズ画面で）
  const handleListenAgainInExampleQuiz = () => {
    setTimeout(() => {
      playAudio(englishAudioRef.current, 0);
    }, 0);
  };

  // ハンドラー: もう一度聞く（最終クイズ画面で）
  const handleListenAgainInFinalQuiz = () => {
    setTimeout(() => {
      playAudio(finalQuizAudioRef.current, 0);
    }, 0);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* ランディングフェーズ */}
      {phase === 'landing' && (
        <div className="relative max-w-[500px] mx-auto">
          <SceneImage
            src={patternSet.examples[0].imageUrl}
            alt={`${patternSet.examples[0].place}での会話シーン`}
            opacity="medium"
          />

          <div className="absolute inset-0 flex items-center justify-center">
            <StartButton error={null} handleStart={handleStart} disabled={isAudioBusy}>
              始める
            </StartButton>
          </div>
        </div>
      )}

      {/* 例文音声フェーズ */}
      {phase === 'example-audio' && currentExample && (
        <div className="relative max-w-[500px] mx-auto">
          <SceneImage
            src={currentExample.imageUrl}
            alt={`${currentExample.place}での会話シーン`}
            opacity="full"
          />
        </div>
      )}

      {/* 例文クイズフェーズ */}
      {phase === 'example-quiz' && currentExample && (
        <div className="relative max-w-[500px] mx-auto">
          {/* 背景画像 */}
          <SceneImage
            src={currentExample.imageUrl}
            alt={`${currentExample.place}での会話シーン`}
            opacity="low"
          />

          {/* クイズUI（画像の上に被せる） */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl">
              <p className="text-xl font-semibold text-[#2a2b3c] mb-4 text-center">
                この英文の意味は？
              </p>
              <ul className="grid gap-3 mb-4">
                {exampleQuizOptions.map((option, index) => (
                  <li key={index}>
                    <button
                      onClick={() => handleExampleQuizAnswer(index)}
                      disabled={isAudioBusy}
                      className="w-full rounded-2xl border border-[#d8cbb6] bg-white px-5 py-4 text-left text-base font-medium text-[#2a2b3c] shadow-sm transition enabled:hover:border-[#2f8f9d] enabled:hover:shadow-md enabled:active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d] disabled:opacity-50"
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex justify-center">
                <button
                  onClick={handleListenAgainInExampleQuiz}
                  disabled={isAudioBusy}
                  className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-white shadow-lg transition enabled:hover:bg-[#257682] disabled:opacity-60"
                >
                  もう一度聞く
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 例文クイズ正解フェーズ */}
      {phase === 'example-correct' && currentExample && (
        <div className="relative max-w-[500px] mx-auto">
          {/* 背景画像 */}
          <SceneImage
            src={currentExample.imageUrl}
            alt={`${currentExample.place}での会話シーン`}
            opacity="low"
          />

          {/* 正解UI（画像の上に被せる） */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-emerald-50/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-emerald-200">
              <h2 className="text-2xl font-bold text-emerald-700 text-center">正解！ 🎉</h2>
              <p className="mt-4 text-xl font-semibold text-[#2a2b3c] text-center">
                {currentExample.englishSentence}
              </p>
              <p className="mt-3 text-base text-[#2a2b3c] text-center">
                {currentExample.japaneseSentence}
              </p>
              {!isLastExample && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleGoToNextExample}
                    disabled={isAudioBusy}
                    className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-white shadow-lg transition enabled:hover:bg-[#c3684f] disabled:opacity-60"
                  >
                    次へ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 例文クイズ不正解フェーズ */}
      {phase === 'example-incorrect' && currentExample && (
        <div className="relative max-w-[500px] mx-auto">
          {/* 背景画像 */}
          <SceneImage
            src={currentExample.imageUrl}
            alt={`${currentExample.place}での会話シーン`}
            opacity="low"
          />

          {/* 不正解UI（画像の上に被せる） */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-rose-50/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-rose-200">
              <h2 className="text-2xl font-bold text-rose-700 text-center">
                残念…もう一度挑戦してみましょう
              </h2>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleRetryCurrentExample}
                  disabled={isAudioBusy}
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-lg border border-[#d8cbb6] transition enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:opacity-60"
                >
                  再挑戦
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 最終クイズフェーズ */}
      {phase === 'final-quiz' && (
        <section className="grid gap-8">
          <div className="flex items-baseline flex-wrap gap-y-2">
            <p className="text-xl font-semibold text-[#2a2b3c] sm:text-2xl">
              「 {patternSet.patternName} 」
            </p>
            <p className="font-semibold text-[#2a2b3c]/70">の意味は？</p>
          </div>
          <ul className="grid gap-3">
            {finalQuizOptions.map((option, index) => (
              <li key={index}>
                <button
                  onClick={() => handleFinalQuizAnswer(index)}
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
              onClick={handleListenAgainInFinalQuiz}
              disabled={isAudioBusy}
              className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:opacity-60"
            >
              もう一度聞く
            </button>
          </div>
        </section>
      )}

      {/* 最終結果フェーズ */}
      {phase === 'final-result' && (
        <section className="grid gap-6 text-center">
          <div
            className={`rounded-3xl border px-6 py-10 shadow-lg shadow-slate-900/10 ${
              isFinalQuizCorrect
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            <h2 className="text-2xl font-bold">
              {isFinalQuizCorrect ? 'やった！ 正解です 🎉' : '残念…もう一度挑戦してみましょう'}
            </h2>
            {isFinalQuizCorrect && (
              <>
                <p className="mt-4 text-2xl font-semibold text-[#2a2b3c]">
                  {patternSet.patternName}
                </p>
                <p className="mt-4 text-lg text-[#2a2b3c]">{patternSet.correctAnswer}</p>
              </>
            )}
          </div>
          <div className="flex justify-center">
            {isFinalQuizCorrect ? (
              <button
                onClick={handleNextPattern}
                disabled={isAudioBusy}
                className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 transition enabled:hover:bg-[#c3684f] disabled:opacity-60"
              >
                次の問題に挑戦
              </button>
            ) : (
              <button
                onClick={handleRetryFromStart}
                disabled={isAudioBusy}
                className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 transition enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:opacity-60"
              >
                最初から再挑戦
              </button>
            )}
          </div>
        </section>
      )}

      {/* 音声要素（例文フェーズ用） */}
      {currentExample && (
        <>
          <audio
            key={`current-english-${currentExample.id}`}
            ref={englishAudioRef}
            src={currentExample.audioEnUrl}
            preload="auto"
            onEnded={handleEnglishAudioEnded}
          />
          <audio
            key={`current-japanese-${currentExample.id}`}
            ref={japaneseAudioRef}
            src={currentExample.audioJaUrl}
            preload="auto"
            onEnded={handleJapaneseAudioEnded}
          />
        </>
      )}

      {/* 最終クイズ用の音声（1枚目の英語文） */}
      {patternSet.examples[0] && (
        <audio
          key={`final-quiz-english-${patternSet.examples[0].id}`}
          ref={finalQuizAudioRef}
          src={patternSet.examples[0].audioEnUrl}
          preload="auto"
          onEnded={() => {
            setTimeout(() => {
              setAudioStatus('idle');
            }, 0);
          }}
        />
      )}

      {/* 最終結果用の音声（2枚目の英語文） */}
      {patternSet.examples[1] && (
        <audio
          key={`final-result-english-${patternSet.examples[1].id}`}
          ref={finalResultAudioRef}
          src={patternSet.examples[1].audioEnUrl}
          preload="auto"
          onEnded={() => {
            setTimeout(() => {
              setAudioStatus('idle');
            }, 0);
          }}
        />
      )}

      {/* 次のパターンの画像プリフェッチ */}
      {nextPatternSet?.examples[0]?.imageUrl && (
        <Image
          src={nextPatternSet.examples[0].imageUrl}
          alt="次のパターンの画像"
          width={500}
          height={750}
          className="hidden"
          priority
          unoptimized
        />
      )}

      {/* 次のパターンの音声プリフェッチ */}
      {nextPatternSet?.examples[0] && (
        <>
          <audio
            key={`next-english-${nextPatternSet.examples[0].id}`}
            src={nextPatternSet.examples[0].audioEnUrl}
            preload="auto"
          />
          <audio
            key={`next-japanese-${nextPatternSet.examples[0].id}`}
            src={nextPatternSet.examples[0].audioJaUrl}
            preload="auto"
          />
        </>
      )}
    </div>
  );
}
