'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ProblemWithAudio } from '@/app/api/problems/route';
import { SceneImage } from '@/components/ui/scene-image';
import { StartButton } from '@/components/ui/start-button';
import { shuffleOptionsWithCorrectIndex, type ShuffledQuizOption } from '@/lib/shuffle-utils';
import { ALLOWED_SHARE_COUNTS } from '@/const';
import { ArrowLeft, ExternalLink, RotateCw, Wrench } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

type ProblemWithStaticFlag = ProblemWithAudio & { isStatic?: boolean };

type ServerPhase = {
  problem: ProblemWithStaticFlag;
} & {
  kind: 'start-button-server';
};

type ClientPhase = {
  setting: Setting;
  problem: ProblemWithStaticFlag;
} & (
  | {
      kind: 'start-button-client';
      error: string | null;
    }
  | {
      kind: 'scene-entry';
    }
  | {
      kind: 'scene-ready';
    }
  | {
      kind: 'quiz';
      shuffledOptions: ShuffledQuizOption[];
      correctIndex: number;
    }
  | {
      kind: 'correct';
    }
  | {
      kind: 'incorrect';
    }
);

type Phase = ServerPhase | ClientPhase;

export type ProblemLength = 'short' | 'medium' | 'long';
export type DifficultyLevel = 'kids' | 'easy' | 'normal' | 'hard' | 'expert';

type ProblemFlowProps = {
  length?: ProblemLength;
  difficultyLevel?: DifficultyLevel;
  initialProblem: ProblemWithStaticFlag;
  isAdminPromise: Promise<boolean>;
};

type ApiProblemsResponse = {
  problems: ProblemWithAudio[];
  count: number;
};

type Setting = {
  isEnglishMode: boolean;
  isImageHiddenMode: boolean;
  correctStreak: number;
};

type EditableIncorrectOptionResult = { ok: true } | { ok: false; message: string };

type RemovableField = 'imageUrl' | 'audioEnUrl' | 'audioEnReplyUrl' | 'audioJaUrl';

export default function ProblemFlow({
  length,
  difficultyLevel,
  initialProblem,
  isAdminPromise,
}: ProblemFlowProps) {
  // ストレージキー用の識別子（lengthまたはdifficultyLevel）
  const storageKey = length || difficultyLevel || 'default';

  // useLocalStorageフックで設定を管理（自動的にタブ間同期される）
  const [isEnglishMode] = useLocalStorage('englishMode', false);
  const [isImageHiddenMode] = useLocalStorage('noImageMode', false);
  const [correctStreak, setCorrectStreak] = useLocalStorage(`correctStreak-${storageKey}`, 0);

  // Setting型を動的に構築
  const getCurrentSetting = useCallback((): Setting => {
    return {
      isEnglishMode,
      isImageHiddenMode,
      correctStreak,
    };
  }, [isEnglishMode, isImageHiddenMode, correctStreak]);
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() ?? '';
  const withSubtitle = searchParams.get('subtitle')?.trim() || undefined;
  const router = useRouter();
  const pathname = usePathname();

  // 直和型のphase状態（統合）
  const [phase, setPhase] = useState<Phase>({
    kind: 'start-button-server',
    problem: initialProblem,
  });

  // グローバル状態（全phase共通）
  const [problemQueue, setProblemQueue] = useState<ProblemWithStaticFlag[]>([]);
  const [isAudioBusy, setAudioBusy] = useState(false);
  const [isDeletingProblem, setDeletingProblem] = useState(false);
  const [isImprovingTranslation, setImprovingTranslation] = useState(false);
  const [isAdminModalOpen, setAdminModalOpen] = useState(false);
  // 現在の問題と画像を取得
  const currentProblem = phase.problem;
  const sceneImage = currentProblem?.imageUrl ?? null;
  const nextProblem = problemQueue[0] ?? null;
  const phaseSetting = phase.kind === 'start-button-server' ? null : phase.setting;
  const englishSentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const japaneseReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const englishReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPrefetchingNextRef = useRef(false);
  const lastQueueLengthRef = useRef(0);
  const regeneratingAssetRef = useRef<Record<RemovableField, boolean>>({
    imageUrl: false,
    audioEnUrl: false,
    audioEnReplyUrl: false,
    audioJaUrl: false,
  });

  // ProblemLength を直接使用
  const playAudio = useCallback((audio: HTMLAudioElement | null, duration: number) => {
    if (!audio) return;

    audio.load();
    setAudioBusy(true);

    setTimeout(() => {
      audio.play().catch(() => {
        console.warn('英語音声の再生に失敗しました。');
        setAudioBusy(false);
      });
    }, 100 + duration);
  }, []);

  // キューに次の問題がなければ追加で問題を取得（常に検索なし）
  const refillQueueIfNeeded = useCallback(async () => {
    // 次の問題（problemQueue[0]）がある、または既に補充中なら何もしない
    if (problemQueue.length > 0 || isPrefetchingNextRef.current) return;

    isPrefetchingNextRef.current = true;

    try {
      // 補充時は常に検索なしで取得
      const params = new URLSearchParams();
      if (length) {
        params.set('type', length);
      }
      if (difficultyLevel) {
        params.set('difficultyLevel', difficultyLevel);
      }
      const response = await fetch(`/api/problems?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiProblemsResponse = await response.json();

        // 新しい問題が取得できなかった場合は、これ以上補充しない
        if (data.problems.length === 0) {
          return;
        }

        setProblemQueue((prev) => {
          const newQueue = [...prev, ...data.problems];
          lastQueueLengthRef.current = newQueue.length;
          return newQueue;
        });
      }
    } catch (err) {
      console.warn('[ProblemFlow] 問題キュー補充失敗:', err);
    } finally {
      isPrefetchingNextRef.current = false;
    }
  }, [difficultyLevel, length, problemQueue.length]);

  // phaseごとの処理
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    // --- phaseごとの副作用をここに統合 ---
    switch (phase.kind) {
      case 'start-button-server': {
        setPhase({
          kind: 'start-button-client',
          error: null,
          problem: phase.problem,
          setting: getCurrentSetting(),
        });
        break;
      }
      case 'scene-entry': {
        const shouldSkipImage = !sceneImage || phase.setting.isImageHiddenMode;
        if (shouldSkipImage) {
          setPhase({
            kind: 'scene-ready',
            problem: phase.problem,
            setting: getCurrentSetting(),
          });
        }

        if (!isPrefetchingNextRef.current) {
          void refillQueueIfNeeded();
        }
        break;
      }
    }
  }, [getCurrentSetting, length, phase, refillQueueIfNeeded, sceneImage]);
  const handleStart = () => {
    if (phase.kind !== 'start-button-client') return;

    setPhase({
      kind: 'scene-entry',
      problem: phase.problem,
      setting: getCurrentSetting(),
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleRetryQuiz = () => {
    setPhase({
      kind: 'scene-entry',
      problem: phase.problem,
      setting: getCurrentSetting(),
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleReplyAudioEnded = () => {
    setAudioBusy(false);

    const { options: shuffledOptions, correctIndex: shuffledCorrectIndex } =
      shuffleOptionsWithCorrectIndex(
        currentProblem.japaneseSentence,
        currentProblem.incorrectOptions,
      );

    if (phase.kind === 'scene-entry' || phase.kind === 'scene-ready') {
      setPhase({
        kind: 'quiz',
        problem: phase.problem,
        shuffledOptions,
        correctIndex: shuffledCorrectIndex,
        setting: getCurrentSetting(),
      });
      void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
    }
  };

  const handleNextProblem = () => {
    if (phase.kind === 'start-button-server') return;

    if (isPrefetchingNextRef.current) return;

    setAdminModalOpen(false);

    // searchパラメータがある場合のみURLをクリア
    if (searchQuery) {
      router.push(pathname);
    }

    // キューの先頭が次の問題
    const nextProblemData = problemQueue[0];

    if (!nextProblemData) {
      // キューが空の場合はエラー状態にする
      console.error('[ProblemFlow] 問題キューが空です');
      setPhase({
        kind: 'start-button-client',
        error: '次の問題がありません',
        problem: currentProblem,
        setting: getCurrentSetting(),
      });
      return;
    }

    // キューから次の問題を削除（これが新たな現在の問題になる）
    setProblemQueue((prev) => prev.slice(1));

    // 切り替え直後に英語音声を再生
    setPhase({
      kind: 'scene-entry',
      problem: nextProblemData,
      setting: getCurrentSetting(),
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleRegenerateAsset = async (
    field: RemovableField,
    {
      confirmMessage,
      errorMessage,
    }: {
      confirmMessage: string;
      errorMessage: string;
    },
  ) => {
    if (currentProblem?.isStatic) {
      if (typeof window !== 'undefined') {
        window.alert('静的な問題は変更できません。');
      }
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    const targetProblemId = currentProblem?.id;

    if (!targetProblemId || regeneratingAssetRef.current[field]) {
      return;
    }

    regeneratingAssetRef.current[field] = true;

    try {
      const response = await fetch('/api/admin/problems/regenerate-asset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ problemId: targetProblemId, field }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? errorMessage);
      }

      const responseData = await response.json();

      // 画像の場合は非同期処理（バックグラウンドで生成）
      if (field === 'imageUrl' && responseData.async) {
        if (typeof window !== 'undefined') {
          window.alert(
            responseData.message || '画像の再生成を依頼しました。完了まで数十秒かかります。',
          );
        }
        return;
      }

      // 音声の場合は同期処理（新しいURLを状態に反映）
      const newUrl = responseData[field];
      if (newUrl) {
        const updatedProblem: ProblemWithStaticFlag = {
          ...currentProblem,
          [field]: newUrl,
          audioReady: false,
        };

        setProblemQueue((prevQueue) =>
          prevQueue.map((problem) =>
            problem.id === targetProblemId
              ? ({
                  ...problem,
                  [field]: newUrl,
                  audioReady: false,
                } as ProblemWithStaticFlag)
              : problem,
          ),
        );

        // 管理者モーダルを閉じる
        setAdminModalOpen(false);

        // scene-entryフェーズに移って、新しい音声を再生
        setPhase({
          kind: 'scene-entry',
          problem: updatedProblem,
          setting: getCurrentSetting(),
        });
        void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
      }
    } catch (error) {
      console.error(`[ProblemFlow] ${field}再生成エラー:`, error);
      if (typeof window !== 'undefined') {
        window.alert(errorMessage);
      }
    } finally {
      regeneratingAssetRef.current[field] = false;
    }
  };

  const handleRegenerateImage = () =>
    handleRegenerateAsset('imageUrl', {
      confirmMessage: 'この問題の画像を再生成しますか？（数十秒かかります）',
      errorMessage: '画像の再生成に失敗しました。',
    });

  const handleRegenerateAudioEn = () =>
    handleRegenerateAsset('audioEnUrl', {
      confirmMessage: '英語音声を再生成しますか？',
      errorMessage: '英語音声の再生成に失敗しました。',
    });

  const handleRegenerateAudioEnReply = () =>
    handleRegenerateAsset('audioEnReplyUrl', {
      confirmMessage: '英語返答音声を再生成しますか？',
      errorMessage: '英語返答音声の再生成に失敗しました。',
    });

  const handleRegenerateAudioJa = () =>
    handleRegenerateAsset('audioJaUrl', {
      confirmMessage: '日本語返答音声を再生成しますか？',
      errorMessage: '日本語返答音声の再生成に失敗しました。',
    });

  const handleDeleteProblem = async () => {
    if (isDeletingProblem) {
      return;
    }

    if (currentProblem?.isStatic) {
      if (typeof window !== 'undefined') {
        window.alert('静的な問題は削除できません。');
      }
      return;
    }

    const targetProblemId = currentProblem?.id;
    if (!targetProblemId) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const confirmed = window.confirm(
      '本当にこの問題自体を削除しますか？\nこの操作は取り消せません。',
    );
    if (!confirmed) {
      return;
    }

    setDeletingProblem(true);

    try {
      const response = await fetch('/api/admin/problems/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ problemId: targetProblemId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.error ?? '問題の削除に失敗しました。';
        window.alert(message);
        return;
      }

      if (phase.kind === 'start-button-server') {
        const updatedQueue = problemQueue.filter((problem) => problem.id !== targetProblemId);
        setProblemQueue(updatedQueue);
        const nextProblemData = updatedQueue[0] ?? null;
        setAdminModalOpen(false);
        setPhase({
          kind: 'start-button-client',
          error: nextProblemData ? null : '次の問題がありません',
          problem: nextProblemData ?? phase.problem,
          setting: getCurrentSetting(),
        });
        return;
      }

      handleNextProblem();
    } catch (error) {
      console.error('[ProblemFlow] 問題削除エラー:', error);
      window.alert('問題の削除に失敗しました。');
    } finally {
      setDeletingProblem(false);
    }
  };

  const handleImproveTranslation = async () => {
    if (isImprovingTranslation) {
      return;
    }

    if (currentProblem?.isStatic) {
      if (typeof window !== 'undefined') {
        window.alert('静的な問題は変更できません。');
      }
      return;
    }

    const targetProblemId = currentProblem?.id;
    const englishSentence = currentProblem?.englishSentence;
    const japaneseSentence = currentProblem?.japaneseSentence;
    const scenePrompt = currentProblem?.scenePrompt;

    if (!targetProblemId || !englishSentence || !japaneseSentence) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    setImprovingTranslation(true);

    try {
      // AIで日本語訳を改善
      const improveResponse = await fetch('/api/admin/problems/improve-translation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ englishSentence, japaneseSentence, scenePrompt }),
      });

      if (!improveResponse.ok) {
        const data = await improveResponse.json().catch(() => null);
        const message = data?.error ?? '日本語訳の改善に失敗しました。';
        window.alert(message);
        return;
      }

      const improveData = await improveResponse.json();
      const newJapaneseSentence = improveData.improvedTranslation;

      if (!newJapaneseSentence || typeof newJapaneseSentence !== 'string') {
        window.alert('改善された日本語訳の取得に失敗しました。');
        return;
      }

      // 確認ダイアログを表示
      const confirmed = window.confirm(
        `「${englishSentence}」の日本語訳を\n「${japaneseSentence}」から\n「${newJapaneseSentence}」に変更していいですか？`,
      );

      if (!confirmed) {
        return;
      }

      // DBを更新
      const updateResponse = await fetch('/api/admin/problems/update-translation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ problemId: targetProblemId, japaneseSentence: newJapaneseSentence }),
      });

      if (!updateResponse.ok) {
        const data = await updateResponse.json().catch(() => null);
        const message = data?.error ?? '日本語訳の更新に失敗しました。';
        window.alert(message);
        return;
      }

      // 成功したら状態を更新
      setPhase((prevPhase) => {
        const updatedProblem: ProblemWithStaticFlag = {
          ...prevPhase.problem,
          japaneseSentence: newJapaneseSentence,
        };

        // quizフェーズの場合、shuffledOptionsの正解選択肢も更新
        if (prevPhase.kind === 'quiz') {
          return {
            ...prevPhase,
            problem: updatedProblem,
            shuffledOptions: prevPhase.shuffledOptions.map((option) =>
              option.kind === 'correct' ? { ...option, text: newJapaneseSentence } : option,
            ),
          };
        }

        return { ...prevPhase, problem: updatedProblem } as Phase;
      });

      setProblemQueue((prevQueue) =>
        prevQueue.map((problem) =>
          problem.id === targetProblemId
            ? ({ ...problem, japaneseSentence: newJapaneseSentence } as ProblemWithStaticFlag)
            : problem,
        ),
      );

      window.alert('日本語訳を更新しました！');
    } catch (error) {
      console.error('[ProblemFlow] 日本語訳改善エラー:', error);
      if (typeof window !== 'undefined') {
        window.alert('日本語訳の改善中にエラーが発生しました。');
      }
    } finally {
      setImprovingTranslation(false);
    }
  };

  const updateIncorrectOption = async (
    incorrectIndex: number,
    nextText: string,
  ): Promise<EditableIncorrectOptionResult> => {
    const problemId = currentProblem?.id;

    if (currentProblem?.isStatic) {
      return { ok: false, message: '静的な問題は編集できません。' };
    }

    if (!problemId) {
      return { ok: false, message: '問題が存在しません。' };
    }

    const trimmedText = nextText.trim();
    if (!trimmedText) {
      return { ok: false, message: '選択肢を入力してください。' };
    }

    try {
      const response = await fetch('/api/admin/problems/update-incorrect-option', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemId,
          optionIndex: incorrectIndex,
          text: trimmedText,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        incorrectOptions: string[];
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.incorrectOptions) {
        return { ok: false, message: data?.error ?? '選択肢の更新に失敗しました。' };
      }

      setPhase((prevPhase) => {
        if (prevPhase.problem.id !== problemId) {
          return prevPhase;
        }

        const updatedProblem = {
          ...prevPhase.problem,
          incorrectOptions: data.incorrectOptions,
        };

        if (prevPhase.kind === 'quiz') {
          return {
            ...prevPhase,
            problem: updatedProblem,
            shuffledOptions: prevPhase.shuffledOptions.map((option) =>
              option.kind === 'incorrect' && option.incorrectIndex === incorrectIndex
                ? { ...option, text: trimmedText }
                : option,
            ),
          };
        }

        return {
          ...prevPhase,
          problem: updatedProblem,
        };
      });

      setProblemQueue((prevQueue) =>
        prevQueue.map((problem) =>
          problem.id === problemId
            ? { ...problem, incorrectOptions: data.incorrectOptions }
            : problem,
        ),
      );

      return { ok: true };
    } catch (error) {
      console.error('[ProblemFlow] 選択肢更新エラー:', error);
      return { ok: false, message: '選択肢の更新に失敗しました。' };
    }
  };

  const handleOptionSelect = (selectedIndex: number) => {
    if (phase.kind !== 'quiz') return;

    const prevSetting = phase.setting;
    const isCorrect = selectedIndex === phase.correctIndex;

    if (isCorrect) {
      const newCorrectStreak = prevSetting.correctStreak + 1;
      setCorrectStreak(newCorrectStreak);

      const newSetting: Setting = {
        ...prevSetting,
        correctStreak: newCorrectStreak,
      };

      setPhase({
        kind: 'correct',
        problem: phase.problem,
        setting: newSetting,
      });
      void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
      return;
    }

    setCorrectStreak(0);

    const newSetting: Setting = {
      ...prevSetting,
      correctStreak: 0,
    };

    setPhase({
      kind: 'incorrect',
      problem: phase.problem,
      setting: newSetting,
    });
  };

  const isOnStreak =
    phaseSetting !== null &&
    ALLOWED_SHARE_COUNTS.includes(
      phaseSetting.correctStreak as (typeof ALLOWED_SHARE_COUNTS)[number],
    );

  const handleSceneImageLoad = useCallback(() => {
    setPhase((prev) => {
      if (prev.kind !== 'scene-entry') return prev;
      return {
        kind: 'scene-ready',
        problem: prev.problem,
        setting: getCurrentSetting(),
      };
    });
  }, [getCurrentSetting]);

  return (
    <div className="max-w-full">
      {phase.kind === 'start-button-server' && (
        <StartButtonServerView onStart={handleStart} disabled={isAudioBusy} />
      )}
      {phase.kind === 'start-button-client' && (
        <StartButtonClientView
          sceneImage={sceneImage}
          place={phase.problem.place}
          isHidden={isImageHiddenMode}
          error={phase.error}
          disabled={isAudioBusy}
          onStart={handleStart}
          sentence1={withSubtitle && phase.problem.japaneseSentence}
          sentence2={withSubtitle && phase.problem.japaneseReply}
          scenePrompt={phase.problem.scenePrompt}
        />
      )}
      {phase.kind === 'scene-entry' && (
        <SceneEntryView
          sceneImage={sceneImage}
          place={phase.problem.place}
          isHidden={phase.setting.isImageHiddenMode}
          onSceneReady={handleSceneImageLoad}
          sentence1={withSubtitle && phase.problem.japaneseSentence}
          sentence2={withSubtitle && phase.problem.japaneseReply}
          scenePrompt={phase.problem.scenePrompt}
        />
      )}
      {phase.kind === 'scene-ready' && (
        <SceneReadyView
          sceneImage={sceneImage}
          place={phase.problem.place}
          isHidden={phase.setting.isImageHiddenMode}
          sentence1={withSubtitle && phase.problem.japaneseSentence}
          sentence2={withSubtitle && phase.problem.japaneseReply}
          scenePrompt={phase.problem.scenePrompt}
        />
      )}
      {phase.kind === 'quiz' && (
        <QuizPhaseView
          phase={phase}
          currentProblem={currentProblem}
          isAdminPromise={isAdminPromise}
          isStaticProblem={currentProblem.isStatic ?? false}
          isAudioBusy={isAudioBusy}
          updateIncorrectOption={updateIncorrectOption}
          onSelectOption={handleOptionSelect}
          onReplayAudio={() => {
            playAudio(englishSentenceAudioRef.current, 0);
          }}
          onRetry={handleRetryQuiz}
        />
      )}
      {phase.kind === 'correct' && (
        <Suspense>
          <CorrectPhaseView
            phase={phase}
            isOnStreak={isOnStreak}
            length={length}
            difficultyLevel={difficultyLevel}
            isAudioBusy={isAudioBusy}
            onNextProblem={handleNextProblem}
            onReplayAudio={() => {
              playAudio(englishSentenceAudioRef.current, 0);
            }}
            isAdminPromise={isAdminPromise}
            isStaticProblem={currentProblem.isStatic ?? false}
          />
        </Suspense>
      )}
      {phase.kind === 'incorrect' && (
        <IncorrectPhaseView phase={phase} isAudioBusy={isAudioBusy} onRetry={handleRetryQuiz} />
      )}

      <audio
        key="currentEnglishSentence"
        ref={englishSentenceAudioRef}
        src={currentProblem.audioEnUrl}
        preload="auto"
        onEnded={() => {
          setAudioBusy(false);
          if (phase.kind === 'quiz' || phase.kind === 'correct') return;
          // scene-entry/scene-ready時のみ、返答音声を続けて再生
          const replyAudioRef =
            phaseSetting && phaseSetting.isEnglishMode
              ? englishReplyAudioRef
              : japaneseReplyAudioRef;
          void (replyAudioRef.current && playAudio(replyAudioRef.current, 0));
        }}
      />
      <audio
        key="currentJapaneseReply"
        ref={japaneseReplyAudioRef}
        src={currentProblem.audioJaUrl}
        preload="auto"
        onEnded={handleReplyAudioEnded}
      />
      <audio
        key="currentEnglishReply"
        ref={englishReplyAudioRef}
        src={currentProblem.audioEnReplyUrl}
        preload="auto"
        onEnded={handleReplyAudioEnded}
      />
      {/* 次の問題の音声と画像 */}
      {nextProblem && (
        <>
          <audio key="nextEnglishSentence" src={nextProblem.audioEnUrl} preload="auto" />
          <audio key="nextJapaneseReply" src={nextProblem.audioJaUrl} preload="auto" />
          <audio key="nextEnglishReply" src={nextProblem.audioEnReplyUrl} preload="auto" />
          {nextProblem.imageUrl && (
            <Image
              unoptimized
              priority
              src={nextProblem.imageUrl}
              className="hidden"
              width={500}
              height={750}
              alt="次の問題の画像"
            />
          )}
        </>
      )}

      <Suspense>
        {isAdminModalOpen ? (
          <AdminProblemActions
            isAdminPromise={isAdminPromise}
            isStaticProblem={currentProblem.isStatic ?? false}
            isDeletingProblem={isDeletingProblem}
            isImprovingTranslation={isImprovingTranslation}
            regeneratingAssetRef={regeneratingAssetRef}
            onRegenerateImage={handleRegenerateImage}
            onRegenerateAudioEn={handleRegenerateAudioEn}
            onRegenerateAudioEnReply={handleRegenerateAudioEnReply}
            onRegenerateAudioJa={handleRegenerateAudioJa}
            onDeleteProblem={handleDeleteProblem}
            onImproveTranslation={handleImproveTranslation}
            isModalOpen={isAdminModalOpen}
            onClose={() => setAdminModalOpen(false)}
          />
        ) : null}
      </Suspense>

      <Suspense>
        <FixedAdminButton
          isAdminPromise={isAdminPromise}
          isStaticProblem={currentProblem.isStatic ?? false}
          onOpenAdminModal={() => setAdminModalOpen(true)}
        />
      </Suspense>
    </div>
  );
}

type StartButtonServerViewProps = {
  onStart: () => void;
  disabled: boolean;
};

function StartButtonServerView({ onStart, disabled }: StartButtonServerViewProps) {
  return (
    <div className="relative w-[500px] max-w-full mx-auto aspect-[2/3]">
      <div className="absolute inset-0 flex items-center justify-center">
        <StartButton error={null} handleStart={onStart} disabled={disabled}>
          英語学習を始める
        </StartButton>
      </div>
    </div>
  );
}

type StartButtonClientViewProps = {
  sceneImage: string | null;
  place: string;
  isHidden: boolean;
  error: string | null;
  disabled: boolean;
  onStart: () => void;
  sentence1?: string;
  sentence2?: string;
  scenePrompt?: string | null;
};

function StartButtonClientView({
  sceneImage,
  place,
  isHidden,
  error,
  disabled,
  onStart,
  sentence1,
  sentence2,
  scenePrompt,
}: StartButtonClientViewProps) {
  return (
    <div className="relative w-[500px] max-w-full mx-auto aspect-[2/3]">
      <SceneDisplay
        imageUrl={sceneImage}
        place={place}
        isHidden={isHidden}
        opacity="medium"
        sentence1={sentence1}
        sentence2={sentence2}
        scenePrompt={scenePrompt}
        isBlurred
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <StartButton error={error} handleStart={onStart} disabled={disabled} autoFocus>
          英語学習を始める
        </StartButton>
      </div>
    </div>
  );
}

type SceneEntryViewProps = {
  sceneImage: string | null;
  place: string;
  isHidden: boolean;
  onSceneReady: () => void;
  sentence1?: string;
  sentence2?: string;
  scenePrompt?: string | null;
};

function SceneEntryView({
  sceneImage,
  place,
  isHidden,
  onSceneReady,
  sentence1,
  sentence2,
  scenePrompt,
}: SceneEntryViewProps) {
  return (
    <SceneDisplay
      imageUrl={sceneImage}
      place={place}
      isHidden={isHidden}
      opacity="full"
      onImageLoad={onSceneReady}
      sentence1={sentence1}
      sentence2={sentence2}
      scenePrompt={scenePrompt}
    />
  );
}

type SceneReadyViewProps = {
  sceneImage: string | null;
  place: string;
  isHidden: boolean;
  sentence1?: string;
  sentence2?: string;
  scenePrompt?: string | null;
};

function SceneReadyView({
  sceneImage,
  place,
  isHidden,
  sentence1,
  sentence2,
  scenePrompt,
}: SceneReadyViewProps) {
  return (
    <SceneDisplay
      imageUrl={sceneImage}
      place={place}
      isHidden={isHidden}
      opacity="full"
      sentence1={sentence1}
      sentence2={sentence2}
      scenePrompt={scenePrompt}
    />
  );
}

type QuizPhaseViewProps = {
  phase: Extract<ClientPhase, { kind: 'quiz' }>;
  currentProblem: ProblemWithStaticFlag;
  isAdminPromise: Promise<boolean>;
  isStaticProblem: boolean;
  isAudioBusy: boolean;
  updateIncorrectOption: (
    incorrectIndex: number,
    nextText: string,
  ) => Promise<EditableIncorrectOptionResult>;
  onSelectOption: (selectedIndex: number) => void;
  onReplayAudio: () => void;
  onRetry: () => void;
};

function QuizPhaseView({
  phase,
  currentProblem,
  isAdminPromise,
  isStaticProblem,
  isAudioBusy,
  updateIncorrectOption,
  onSelectOption,
  onReplayAudio,
  onRetry,
}: QuizPhaseViewProps) {
  return (
    <Suspense>
      <QuizOptionsSection
        key={phase.problem.id}
        phase={phase}
        currentProblem={currentProblem}
        isAdminPromise={isAdminPromise}
        isStaticProblem={isStaticProblem}
        isAudioBusy={isAudioBusy}
        updateIncorrectOption={updateIncorrectOption}
        onSelectOption={onSelectOption}
        onReplayAudio={onReplayAudio}
        onRetry={onRetry}
      />
    </Suspense>
  );
}

type CorrectPhaseViewProps = {
  phase: Extract<ClientPhase, { kind: 'correct' }>;
  isOnStreak: boolean;
  length?: ProblemLength;
  difficultyLevel?: DifficultyLevel;
  isAudioBusy: boolean;
  onNextProblem: () => void;
  onReplayAudio: () => void;
  isAdminPromise: Promise<boolean>;
  isStaticProblem: boolean;
};

function CorrectPhaseView({
  phase,
  isOnStreak,
  length,
  difficultyLevel,
  isAudioBusy,
  onNextProblem,
  onReplayAudio,
}: CorrectPhaseViewProps) {
  const [imageVariant] = useState(() => Math.floor(Math.random() * 2) + 1);
  const [selectedText, setSelectedText] = useState('');
  const englishSentenceRef = useRef<HTMLParagraphElement>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // selectionchangeイベントリスナーを追加
  useEffect(() => {
    const handleSelectionChange = () => {
      // 既存のタイマーをクリア
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
        selectionTimeoutRef.current = null;
      }

      selectionTimeoutRef.current = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          return;
        }

        if (!englishSentenceRef.current) {
          return;
        }

        const range = selection.getRangeAt(0);
        const selectedTextContent = range.toString().trim();

        // 選択範囲が空の場合は何もしない
        if (!selectedTextContent) {
          return;
        }

        // 選択範囲の開始位置が<p>要素内にあることを確認
        const startContainer = range.startContainer;

        // テキストノードの場合は親要素を確認
        const startElement =
          startContainer.nodeType === Node.TEXT_NODE
            ? startContainer.parentElement
            : (startContainer as Element);

        const isStartInParagraph =
          startElement &&
          (englishSentenceRef.current.contains(startElement) ||
            startElement === englishSentenceRef.current);

        // 開始位置が<p>要素内でない場合は無視
        if (!isStartInParagraph) {
          return;
        }

        // 選択範囲のテキストが<p>要素のテキストと一致するか確認
        const paragraphText = englishSentenceRef.current.textContent?.trim() || '';

        // 選択範囲のテキストが<p>要素のテキストと一致する、または選択範囲のテキストが<p>要素のテキストに含まれる場合
        if (selectedTextContent === paragraphText || paragraphText.includes(selectedTextContent)) {
          setSelectedText(selectedTextContent);
        }
      }, 300);
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <section className="grid text-center w-[500px] max-w-full mx-auto pt-4">
      <div className="mb-6 text-[var(--success)]">
        <h2 className="text-4xl font-bold flex justify-center items-center gap-4">
          <div className="transform scale-x-[-1]">🎉</div>
          <div className="flex flex-row items-center justify-center gap-2 flex-wrap">
            {isOnStreak && <div>{phase.setting.correctStreak}問連続</div>}
            <div>正解</div>
          </div>
          <div>🎉</div>
        </h2>
        <div className="mt-6 flex justify-center max-w-[30%] sm:max-w-[120px] mx-auto relative">
          <Image
            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/correct${imageVariant}.webp`}
            alt="ガッツポーズ"
            width={500}
            height={750}
            unoptimized
            priority
            className={isOnStreak ? 'opacity-50' : ''}
          />
          {isOnStreak && (
            <button
              type="button"
              onClick={() => {
                const courseIdentifier = length || difficultyLevel || 'default';
                const courseName =
                  courseIdentifier.charAt(0).toUpperCase() + courseIdentifier.slice(1);
                const shareUrl = `${window.location.origin}?streak=${phase.setting.correctStreak}`;
                const tweetText = `【英語きわめ太郎】${courseName}コースで${phase.setting.correctStreak}問連続正解しました！`;
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
                window.open(twitterUrl, '_blank', 'width=550,height=420');
              }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-[var(--share-button-bg)] px-6 py-3 text-base font-semibold text-[var(--share-button-text)] shadow-lg shadow-[var(--share-button-shadow)]/50 enabled:hover:bg-[var(--share-button-hover)]"
            >
              𝕏 で自慢する
            </button>
          )}
        </div>
        <p
          ref={englishSentenceRef}
          className="py-4 text-2xl font-semibold text-[var(--text)] select-text cursor-text"
        >
          {phase.problem.englishSentence}
        </p>
        {selectedText && (
          <div className="mb-4">
            <a
              href={`https://www.deepl.com/translator#en/ja/${encodeURIComponent(selectedText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--border)] bg-[var(--background)] pl-3 pr-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 hover:border-[var(--secondary)] hover:text-[var(--secondary)]"
            >
              「{selectedText}」を DeepL で翻訳する
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
        <p className="text-lg text-[var(--text)]">{phase.problem.japaneseSentence}</p>
      </div>
      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={onReplayAudio}
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] p-3 text-base font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)] disabled:opacity-30"
          disabled={isAudioBusy}
          aria-label="もう一度聞く"
        >
          <RotateCw className="w-5 h-5" />
        </button>
        <button
          key={isAudioBusy ? 'disabled' : 'enabled'}
          autoFocus
          type="button"
          onClick={onNextProblem}
          className="inline-flex items-center justify-center rounded-full bg-[var(--secondary)] px-6 py-3 text-base font-semibold text-[var(--secondary-text)] shadow-lg shadow-[var(--secondary)]/40 enabled:hover:bg-[var(--secondary-hover)] disabled:opacity-30"
          disabled={isAudioBusy}
        >
          次の問題へ
        </button>
      </div>
    </section>
  );
}

type IncorrectPhaseViewProps = {
  isAudioBusy: boolean;
  onRetry: () => void;
  phase: Extract<ClientPhase, { kind: 'incorrect' }>;
};

function IncorrectPhaseView({ isAudioBusy, onRetry }: IncorrectPhaseViewProps) {
  const [imageVariant] = useState(() => Math.floor(Math.random() * 2) + 1);

  return (
    <section className="grid gap-2 text-center">
      <div className="px-6 py-6 text-[var(--error-dark)]">
        <h2 className="text-4xl font-bold pl-4">残念…</h2>
        <div className="mt-6 flex justify-center max-w-[30%] sm:max-w-[120px] mx-auto">
          <Image
            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/incorrect${imageVariant}.webp`}
            alt="ショックな様子"
            width={500}
            height={750}
            unoptimized
            priority
          />
        </div>
      </div>
      <div className="flex flex-row gap-3 items-center justify-center">
        <button
          key={isAudioBusy ? 'disabled' : 'enabled'}
          autoFocus
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] px-6 py-3 text-base font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)] disabled:opacity-30"
          disabled={isAudioBusy}
        >
          再挑戦
        </button>
      </div>
    </section>
  );
}

type QuizOptionsSectionProps = {
  phase: Extract<ClientPhase, { kind: 'quiz' }>;
  currentProblem: ProblemWithStaticFlag;
  isAdminPromise: Promise<boolean>;
  isStaticProblem: boolean;
  isAudioBusy: boolean;
  updateIncorrectOption: (
    incorrectIndex: number,
    nextText: string,
  ) => Promise<EditableIncorrectOptionResult>;
  onSelectOption: (selectedIndex: number) => void;
  onReplayAudio: () => void;
  onRetry: () => void;
};

function QuizOptionsSection({
  phase,
  currentProblem,
  isAdminPromise,
  isStaticProblem,
  isAudioBusy,
  updateIncorrectOption,
  onSelectOption,
  onReplayAudio,
  onRetry,
}: QuizOptionsSectionProps) {
  const [editingIncorrectOptionKey, setEditingIncorrectOptionKey] = useState<string | null>(null);
  const isAdmin = use(isAdminPromise);
  const canEditCurrentProblem = isAdmin && !isStaticProblem;

  return (
    <section className="grid w-[500px] max-w-full max-w-full mx-auto pt-3">
      <div>
        <p className="text-center text-xl font-semibold text-[var(--text)] sm:text-2xl">
          この英文の意味は？
        </p>
      </div>
      <ul className="grid gap-3 mt-6">
        {phase.shuffledOptions.map((option, index) => {
          const optionKey =
            option.kind === 'incorrect'
              ? `${currentProblem.id}-incorrect-${option.incorrectIndex}`
              : `${currentProblem.id}-correct`;
          const defaultIncorrectValue =
            option.kind === 'incorrect' && option.incorrectIndex !== null
              ? (currentProblem.incorrectOptions[option.incorrectIndex] ?? option.text)
              : null;
          const isEditing = option.kind === 'incorrect' && editingIncorrectOptionKey === optionKey;

          return (
            <li key={`${optionKey}-${index}`} className="space-y-2">
              {isEditing && option.kind === 'incorrect' && defaultIncorrectValue !== null ? (
                <EditableIncorrectOption
                  defaultValue={defaultIncorrectValue}
                  onCancel={() => setEditingIncorrectOptionKey(null)}
                  onSubmit={async (value) => {
                    const result = await updateIncorrectOption(option.incorrectIndex, value);
                    if (result.ok) {
                      setEditingIncorrectOptionKey(null);
                      return { ok: true as const };
                    }

                    return { ok: false as const, message: result.message };
                  }}
                />
              ) : (
                <div className="relative">
                  <button
                    key={`${optionKey}-${index}-${isAudioBusy ? 'disabled' : 'enabled'}`}
                    autoFocus={index === 0}
                    type="button"
                    onClick={() => onSelectOption(index)}
                    className={`w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-5 py-4 ${canEditCurrentProblem ? 'pr-20' : 'pr-5'} text-left text-base font-medium text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--primary)] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner disabled:opacity-40`}
                    disabled={isAudioBusy}
                  >
                    {option.text}
                  </button>
                  {canEditCurrentProblem &&
                    (option.kind === 'incorrect' ? (
                      <button
                        type="button"
                        onClick={() => setEditingIncorrectOptionKey(optionKey)}
                        tabIndex={-1}
                        className="absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-center justify-center rounded-tr-2xl rounded-br-2xl h-[100%] border border-[var(--primary)] bg-[var(--background)] p-2 text-sm min-w-[4rem] font-semibold text-[var(--primary)] shadow-sm enabled:hover:bg-[var(--primary)] enabled:hover:text-[var(--primary-text)]"
                      >
                        編集
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.alert('これは正解です');
                          }
                        }}
                        tabIndex={-1}
                        className="absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-center justify-center rounded-tr-2xl rounded-br-2xl h-[100%] border border-[var(--primary)] bg-[var(--background)] p-2 text-sm min-w-[4rem] font-semibold text-[var(--primary)] shadow-sm enabled:hover:bg-[var(--primary)] enabled:hover:text-[var(--primary-text)]"
                      >
                        編集
                      </button>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-center mt-6 gap-4">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] p-3 text-base font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)] disabled:opacity-30"
          disabled={isAudioBusy}
          aria-label="戻る"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onReplayAudio}
          className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-base font-semibold text-[var(--primary-text)] shadow-lg shadow-[var(--primary)]/30 enabled:hover:bg-[var(--primary-hover)] disabled:opacity-30"
          disabled={!phase.problem.audioEnUrl || isAudioBusy}
        >
          もう一度聞く
        </button>
      </div>
    </section>
  );
}

type AdminProblemActionsProps = {
  isAdminPromise: Promise<boolean>;
  isStaticProblem: boolean;
  isDeletingProblem: boolean;
  isImprovingTranslation: boolean;
  regeneratingAssetRef: React.MutableRefObject<Record<RemovableField, boolean>>;
  onRegenerateImage: () => void;
  onRegenerateAudioEn: () => void;
  onRegenerateAudioEnReply: () => void;
  onRegenerateAudioJa: () => void;
  onDeleteProblem: () => void;
  onImproveTranslation: () => void;
  isModalOpen: boolean;
  onClose: () => void;
};

function AdminProblemActions({
  isAdminPromise,
  isStaticProblem,
  isDeletingProblem,
  isImprovingTranslation,
  regeneratingAssetRef,
  onRegenerateImage,
  onRegenerateAudioEn,
  onRegenerateAudioEnReply,
  onRegenerateAudioJa,
  onDeleteProblem,
  onImproveTranslation,
  isModalOpen,
  onClose,
}: AdminProblemActionsProps) {
  const isAdmin = use(isAdminPromise);
  const canEditCurrentProblem = isAdmin && !isStaticProblem;
  const [, forceUpdate] = useState({});

  // refの変更を検知するために定期的にチェック
  useEffect(() => {
    if (!isModalOpen) return;

    const interval = setInterval(() => {
      forceUpdate({});
    }, 100);

    return () => clearInterval(interval);
  }, [isModalOpen]);

  if (!canEditCurrentProblem || !isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="管理者向け機能"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-[var(--dialog-background)] p-6 shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-6">
          <button
            type="button"
            onClick={onRegenerateImage}
            className="inline-flex w-full items-center justify-center rounded-full bg-[var(--admin-remove)] px-6 py-3 text-base font-semibold text-[var(--primary-text)] shadow-lg shadow-[var(--admin-remove)]/30 transition enabled:hover:bg-[var(--admin-remove-hover)] disabled:cursor-not-allowed disabled:opacity-30"
          >
            画像を再生成する
          </button>
          <button
            type="button"
            onClick={onImproveTranslation}
            disabled={isImprovingTranslation}
            className="inline-flex w-full items-center justify-center rounded-full bg-yellow-500 px-6 py-3 text-base font-semibold text-[var(--primary-text)] shadow-lg shadow-[var(--admin-audio-en)]/30 transition enabled:hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isImprovingTranslation ? '改善中…' : '日本語訳を改善する'}
          </button>
          <div className="space-y-3">
            <button
              type="button"
              onClick={onRegenerateAudioEn}
              disabled={regeneratingAssetRef.current.audioEnUrl}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--admin-audio-en)] px-6 py-3 text-base font-semibold text-[var(--primary-text)] shadow-lg shadow-[var(--admin-audio-en)]/30 transition enabled:hover:bg-[var(--admin-audio-en-hover)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {regeneratingAssetRef.current.audioEnUrl ? '再生成中...' : '英語音声を再生成する'}
            </button>
            <button
              type="button"
              onClick={onRegenerateAudioEnReply}
              disabled={regeneratingAssetRef.current.audioEnReplyUrl}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--admin-audio-en-reply)] px-6 py-3 text-base font-semibold text-[var(--primary-text)] shadow-lg shadow-[var(--admin-audio-en-reply)]/30 transition enabled:hover:bg-[var(--admin-audio-en-reply-hover)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {regeneratingAssetRef.current.audioEnReplyUrl
                ? '再生成中...'
                : '英語返答音声を再生成する'}
            </button>
            <button
              type="button"
              onClick={onRegenerateAudioJa}
              disabled={regeneratingAssetRef.current.audioJaUrl}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--admin-audio-ja)] px-6 py-3 text-base font-semibold text-[var(--primary-text)] shadow-lg shadow-[var(--admin-audio-ja)]/30 transition enabled:hover:bg-[var(--admin-audio-ja-hover)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {regeneratingAssetRef.current.audioJaUrl
                ? '再生成中...'
                : '日本語返答音声を再生成する'}
            </button>
          </div>
          <button
            type="button"
            onClick={onDeleteProblem}
            disabled={isDeletingProblem}
            className="inline-flex w-full items-center justify-center rounded-full bg-[var(--admin-delete)] px-6 py-3 text-base font-semibold text-[var(--primary-text)] shadow-lg shadow-[var(--admin-delete)]/30 transition enabled:hover:bg-[var(--admin-delete-hover)] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isDeletingProblem ? '削除中…' : '問題自体を削除する'}
          </button>
        </div>
        <div className="flex justify-center mt-20">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] px-6 py-3 text-base font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)]"
            aria-label="モーダルを閉じる"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

type FixedAdminButtonProps = {
  isAdminPromise: Promise<boolean>;
  isStaticProblem: boolean;
  onOpenAdminModal: () => void;
};

function FixedAdminButton({
  isAdminPromise,
  isStaticProblem,
  onOpenAdminModal,
}: FixedAdminButtonProps) {
  const isAdmin = use(isAdminPromise);
  const canEditCurrentProblem = isAdmin && !isStaticProblem;

  if (!canEditCurrentProblem) return null;

  return (
    <button
      type="button"
      onClick={onOpenAdminModal}
      tabIndex={-1}
      className="fixed bottom-4 left-4 z-50 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] h-13 w-13 text-base font-semibold text-[var(--text)] shadow-lg shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)]"
      aria-label="管理機能を開く"
    >
      <Wrench className="w-5 h-5" />
    </button>
  );
}

type EditableIncorrectOptionProps = {
  defaultValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => Promise<EditableIncorrectOptionResult>;
};

function EditableIncorrectOption({
  defaultValue,
  onCancel,
  onSubmit,
}: EditableIncorrectOptionProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ text: string }>({
    defaultValues: { text: defaultValue },
  });

  useEffect(() => {
    reset({ text: defaultValue });
  }, [defaultValue, reset]);

  const submit = handleSubmit(async ({ text }) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('text', { type: 'manual', message: '選択肢を入力してください。' });
      return;
    }

    const result = await onSubmit(trimmed);
    if (!result.ok) {
      setError('root', { type: 'manual', message: result.message });
      return;
    }

    reset({ text: trimmed });
  });

  return (
    <form
      onSubmit={submit}
      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-5 py-4 text-left shadow-sm shadow-[var(--border)]/40"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          {...register('text')}
          autoFocus
          disabled={isSubmitting}
          className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2 text-base text-[var(--text)] shadow-sm"
        />
        <div className="flex gap-2 sm:justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-text)] shadow enabled:hover:bg-[var(--primary-hover)] disabled:opacity-30"
          >
            {isSubmitting ? '更新中…' : '更新'}
          </button>
          <button
            type="button"
            onClick={() => {
              onCancel();
              reset({ text: defaultValue });
            }}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)] disabled:opacity-30"
          >
            キャンセル
          </button>
        </div>
      </div>
      {(errors.text || errors.root) && (
        <p className="mt-2 text-sm text-[var(--error-dark)]">
          {errors.text?.message ?? errors.root?.message}
        </p>
      )}
    </form>
  );
}

// 共通シーン表示コンポーネント
function SceneDisplay({
  imageUrl,
  place,
  isHidden,
  opacity,
  onImageLoad,
  sentence1,
  sentence2,
  scenePrompt,
  isBlurred = false,
}: {
  imageUrl: string | null;
  place: string;
  isHidden: boolean;
  opacity: 'medium' | 'full';
  onImageLoad?: () => void;
  sentence1?: string;
  sentence2?: string;
  scenePrompt?: string | null;
  isBlurred?: boolean;
}) {
  if (imageUrl && !isHidden) {
    return (
      <section>
        <figure className="flex w-full justify-center">
          <SceneImage
            src={imageUrl}
            alt={scenePrompt ?? '英語と日本語のセリフを並べた2コマシーン'}
            opacity={opacity}
            onLoad={onImageLoad}
            sentence1={sentence1}
            sentence2={sentence2}
            isBlurred={isBlurred}
          />
        </figure>
      </section>
    );
  }

  return (
    <section className={`${isBlurred ? 'hidden' : ''}`}>
      <div className="w-[300px] p-6 text-center text-[var(--text)] leading-relaxed bg-[var(--background)] rounded-lg border border-[var(--scene-box-border)]">
        <h3 className="font-semibold mb-3 text-lg text-[var(--primary)]">シーン</h3>
        <p className="font-bold text-2xl">{place}</p>
      </div>
    </section>
  );
}
