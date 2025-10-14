'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Dispatch,
  SetStateAction,
  Suspense,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { ProblemWithAudio } from '@/app/api/problems/route';
import { SceneImage } from '@/components/ui/scene-image';
import { StartButton } from '@/components/ui/start-button';
import { shuffleOptionsWithCorrectIndex, type ShuffledQuizOption } from '@/lib/shuffle-utils';
import { ALLOWED_SHARE_COUNTS } from '@/const';

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

type ProblemFlowProps = {
  length: ProblemLength;
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

const getCurrentSetting = (length: ProblemLength): Setting => {
  if (typeof window === 'undefined')
    return {
      isEnglishMode: false,
      isImageHiddenMode: false,
      correctStreak: 0,
    };

  const correctStreakCount = localStorage.getItem(`correctStreak-${length}`);

  return {
    isEnglishMode: localStorage.getItem('englishMode') === 'true',
    isImageHiddenMode: localStorage.getItem('noImageMode') === 'true',
    correctStreak: Number(correctStreakCount) ?? 0,
  };
};

export default function ProblemFlow({ length, initialProblem, isAdminPromise }: ProblemFlowProps) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.trim() ?? '';
  const router = useRouter();
  const pathname = usePathname();

  // 直和型のphase状態（統合）
  const [phase, setPhase] = useState<Phase>({
    kind: 'start-button-server',
    problem: initialProblem,
  });

  // グローバル状態（全phase共通）
  const [problemQueue, setProblemQueue] = useState<ProblemWithStaticFlag[]>([initialProblem]);
  const [isAudioBusy, setAudioBusy] = useState(false);
  const [editingIncorrectOptionKey, setEditingIncorrectOptionKey] = useState<string | null>(null);
  const [isDeletingProblem, setDeletingProblem] = useState(false);
  // 現在の問題と画像を取得
  const currentProblem = phase.problem;
  const sceneImage = currentProblem?.imageUrl ?? null;
  const nextProblem = problemQueue[1] ?? null;
  const phaseSetting = phase.kind === 'start-button-server' ? null : phase.setting;
  const englishSentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const japaneseReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const englishReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPrefetchingNextRef = useRef(false);
  const lastQueueLengthRef = useRef(0);
  const removingAssetRef = useRef<Record<RemovableField, boolean>>({
    imageUrl: false,
    audioEnUrl: false,
    audioEnReplyUrl: false,
    audioJaUrl: false,
  });

  const persistSetting = useCallback(
    (prevSetting: Setting, nextSetting: Setting) => {
      if (typeof window === 'undefined') return;

      const keys = {
        isEnglishMode: 'englishMode',
        isImageHiddenMode: 'noImageMode',
        correctStreak: `correctStreak-${length}`,
      } as const satisfies Record<keyof Setting, string>;

      (Object.keys(keys) as Array<keyof Setting>).forEach((key) => {
        if (prevSetting[key] !== nextSetting[key]) {
          const storageKey = keys[key];
          localStorage.setItem(storageKey, nextSetting[key].toString());
        }
      });
    },
    [length],
  );

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

  console.log(`[ProblemFlow] キュー${problemQueue.length}件`);

  // キューに次の問題がなければ追加で問題を取得（常に検索なし）
  const refillQueueIfNeeded = useCallback(async () => {
    // 次の問題（problemQueue[1]）がある、または既に補充中なら何もしない
    if (problemQueue.length > 1 || isPrefetchingNextRef.current) return;

    console.log('[ProblemFlow] キュー補充チェック: 補充開始');
    isPrefetchingNextRef.current = true;

    try {
      // 補充時は常に検索なしで取得
      const params = new URLSearchParams({ type: length });
      const response = await fetch(`/api/problems?${params.toString()}`, { cache: 'no-store' });

      if (response.ok) {
        const data: ApiProblemsResponse = await response.json();

        // 新しい問題が取得できなかった場合は、これ以上補充しない
        if (data.problems.length === 0) {
          console.log('[ProblemFlow] 問題キュー補充: 新しい問題がありません');
          return;
        }

        setProblemQueue((prev) => {
          const newQueue = [...prev, ...data.problems];
          lastQueueLengthRef.current = newQueue.length;
          return newQueue;
        });
        console.log('[ProblemFlow] 問題キュー補充完了:', data.count, '件追加');
      }
    } catch (err) {
      console.warn('[ProblemFlow] 問題キュー補充失敗:', err);
    } finally {
      isPrefetchingNextRef.current = false;
    }
  }, [length, problemQueue.length]);

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
          setting: getCurrentSetting(length),
        });
        break;
      }
      case 'scene-entry': {
        const shouldSkipImage = !sceneImage || phase.setting.isImageHiddenMode;
        if (shouldSkipImage) {
          setPhase({
            kind: 'scene-ready',
            problem: phase.problem,
            setting: getCurrentSetting(length),
          });
        }

        if (!isPrefetchingNextRef.current) {
          void refillQueueIfNeeded();
        }
        break;
      }
    }
  }, [length, phase, refillQueueIfNeeded, sceneImage]);

  useEffect(() => {
    setEditingIncorrectOptionKey(null);
  }, [currentProblem.id]);

  useEffect(() => {
    if (phase.kind !== 'quiz') {
      setEditingIncorrectOptionKey(null);
    }
  }, [phase.kind]);

  const handleStart = () => {
    if (phase.kind !== 'start-button-client') return;

    setPhase({
      kind: 'scene-entry',
      problem: phase.problem,
      setting: getCurrentSetting(length),
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleRetryQuiz = () => {
    if (phase.kind === 'incorrect') {
      setPhase({
        kind: 'scene-entry',
        problem: phase.problem,
        setting: getCurrentSetting(length),
      });
      void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
    }
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
        setting: getCurrentSetting(length),
      });
      void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
    }
  };

  const handleNextProblem = () => {
    if (phase.kind === 'start-button-server') return;

    if (isPrefetchingNextRef.current) return;

    // searchパラメータがある場合のみURLをクリア
    if (searchQuery) {
      router.push(pathname);
    }

    // キューから先頭を削除して、次の問題を取得
    const nextProblemData = problemQueue[1];

    if (!nextProblemData) {
      // キューが空の場合はエラー状態にする
      console.error('[ProblemFlow] 問題キューが空です');
      setPhase({
        kind: 'start-button-client',
        error: '次の問題がありません',
        problem: currentProblem,
        setting: getCurrentSetting(length),
      });
      return;
    }

    // キューから現在の問題を削除
    setProblemQueue((prev) => prev.slice(1));

    // 切り替え直後に英語音声を再生
    setPhase({
      kind: 'scene-entry',
      problem: nextProblemData,
      setting: getCurrentSetting(length),
    });
    void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
  };

  const handleRemoveAsset = async (
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
    const currentAssetValue =
      currentProblem && (currentProblem as Record<RemovableField, string | null>)[field];

    if (!targetProblemId || !currentAssetValue || removingAssetRef.current[field]) {
      return;
    }

    removingAssetRef.current[field] = true;

    try {
      const response = await fetch('/api/admin/problems/remove-image', {
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

      setPhase((prevPhase) => {
        const updatedProblem: ProblemWithStaticFlag = {
          ...prevPhase.problem,
          [field]: null,
          ...(field === 'imageUrl' ? {} : { audioReady: false }),
        };
        return { ...prevPhase, problem: updatedProblem } as Phase;
      });

      setProblemQueue((prevQueue) =>
        prevQueue.map((problem) =>
          problem.id === targetProblemId
            ? ({
                ...problem,
                [field]: null,
                ...(field === 'imageUrl' ? {} : { audioReady: false }),
              } as ProblemWithStaticFlag)
            : problem,
        ),
      );
    } catch (error) {
      console.error(`[ProblemFlow] ${field}削除エラー:`, error);
    } finally {
      removingAssetRef.current[field] = false;
    }
  };

  const handleRemoveImage = () =>
    handleRemoveAsset('imageUrl', {
      confirmMessage: '本当にこの問題の画像を削除しますか？',
      errorMessage: '画像の削除に失敗しました。',
    });

  const handleRemoveAudioEn = () =>
    handleRemoveAsset('audioEnUrl', {
      confirmMessage: '本当に英語音声を削除しますか？',
      errorMessage: '英語音声の削除に失敗しました。',
    });

  const handleRemoveAudioEnReply = () =>
    handleRemoveAsset('audioEnReplyUrl', {
      confirmMessage: '本当に英語返答音声を削除しますか？',
      errorMessage: '英語返答音声の削除に失敗しました。',
    });

  const handleRemoveAudioJa = () =>
    handleRemoveAsset('audioJaUrl', {
      confirmMessage: '本当に日本語返答音声を削除しますか？',
      errorMessage: '日本語返答音声の削除に失敗しました。',
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
        setProblemQueue((prevQueue) =>
          prevQueue.filter((problem) => problem.id !== targetProblemId),
        );
        const nextProblemData =
          problemQueue.find((problem) => problem.id !== targetProblemId) ?? null;
        setPhase({
          kind: 'start-button-client',
          error: nextProblemData ? null : '次の問題がありません',
          problem: nextProblemData ?? phase.problem,
          setting: getCurrentSetting(length),
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
      const newSetting: Setting = {
        ...prevSetting,
        correctStreak: prevSetting.correctStreak + 1,
      };
      persistSetting(prevSetting, newSetting);

      setPhase({
        kind: 'correct',
        problem: phase.problem,
        setting: newSetting,
      });
      void (englishSentenceAudioRef.current && playAudio(englishSentenceAudioRef.current, 0));
      return;
    }

    const newSetting: Setting = {
      ...prevSetting,
      correctStreak: 0,
    };
    persistSetting(prevSetting, newSetting);

    setPhase({
      kind: 'incorrect',
      problem: phase.problem,
      setting: newSetting,
    });
  };

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSettingChange = () => {
      setPhase((prev) => {
        if (prev.kind !== 'start-button-client') return prev;
        const refreshedSetting = getCurrentSetting(length);
        return {
          ...prev,
          setting: refreshedSetting,
        };
      });
    };

    window.addEventListener('problem-setting-change', handleSettingChange);

    return () => {
      window.removeEventListener('problem-setting-change', handleSettingChange);
    };
  }, [length]);

  const isOnStreak =
    phaseSetting !== null &&
    ALLOWED_SHARE_COUNTS.includes(
      phaseSetting.correctStreak as (typeof ALLOWED_SHARE_COUNTS)[number],
    );

  const handleSceneImageLoad = useCallback(() => {
    console.log('[ProblemFlow] 画像読み込み完了');
    setPhase((prev) => {
      if (prev.kind !== 'scene-entry') return prev;
      return {
        kind: 'scene-ready',
        problem: prev.problem,
        setting: getCurrentSetting(length),
      };
    });
  }, [length]);

  return (
    <>
      {phase.kind === 'start-button-server' && (
        <StartButtonServerView onStart={handleStart} disabled={isAudioBusy} />
      )}
      {phase.kind === 'start-button-client' && (
        <StartButtonClientView
          sceneImage={sceneImage}
          place={phase.problem.place}
          isHidden={phase.setting.isImageHiddenMode}
          error={phase.error}
          disabled={isAudioBusy}
          onStart={handleStart}
        />
      )}
      {phase.kind === 'scene-entry' && (
        <SceneEntryView
          sceneImage={sceneImage}
          place={phase.problem.place}
          isHidden={phase.setting.isImageHiddenMode}
          onSceneReady={handleSceneImageLoad}
        />
      )}
      {phase.kind === 'scene-ready' && (
        <SceneReadyView
          sceneImage={sceneImage}
          place={phase.problem.place}
          isHidden={phase.setting.isImageHiddenMode}
        />
      )}
      {phase.kind === 'quiz' && (
        <QuizPhaseView
          phase={phase}
          currentProblem={currentProblem}
          isAdminPromise={isAdminPromise}
          isStaticProblem={currentProblem.isStatic ?? false}
          isAudioBusy={isAudioBusy}
          editingIncorrectOptionKey={editingIncorrectOptionKey}
          onChangeEditingIncorrectOption={setEditingIncorrectOptionKey}
          updateIncorrectOption={updateIncorrectOption}
          onSelectOption={handleOptionSelect}
          onReplayAudio={() => {
            playAudio(englishSentenceAudioRef.current, 0);
          }}
        />
      )}
      {phase.kind === 'correct' && (
        <CorrectPhaseView
          phase={phase}
          isOnStreak={isOnStreak}
          length={length}
          isAudioBusy={isAudioBusy}
          onNextProblem={handleNextProblem}
        />
      )}
      {phase.kind === 'incorrect' && (
        <IncorrectPhaseView isAudioBusy={isAudioBusy} onRetry={handleRetryQuiz} />
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
        <AdminProblemActions
          isAdminPromise={isAdminPromise}
          isStaticProblem={currentProblem.isStatic ?? false}
          sceneImage={sceneImage}
          currentProblem={currentProblem}
          isDeletingProblem={isDeletingProblem}
          onRemoveImage={handleRemoveImage}
          onRemoveAudioEn={handleRemoveAudioEn}
          onRemoveAudioEnReply={handleRemoveAudioEnReply}
          onRemoveAudioJa={handleRemoveAudioJa}
          onDeleteProblem={handleDeleteProblem}
        />
      </Suspense>
    </>
  );
}

type StartButtonServerViewProps = {
  onStart: () => void;
  disabled: boolean;
};

function StartButtonServerView({ onStart, disabled }: StartButtonServerViewProps) {
  return (
    <div className="relative max-w-[500px] mx-auto aspect-[2/3]">
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
};

function StartButtonClientView({
  sceneImage,
  place,
  isHidden,
  error,
  disabled,
  onStart,
}: StartButtonClientViewProps) {
  return (
    <div className="relative max-w-[500px] mx-auto aspect-[2/3]">
      <SceneDisplay imageUrl={sceneImage} place={place} isHidden={isHidden} opacity="medium" />
      <div className="absolute inset-0 flex items-center justify-center">
        <StartButton error={error} handleStart={onStart} disabled={disabled}>
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
};

function SceneEntryView({ sceneImage, place, isHidden, onSceneReady }: SceneEntryViewProps) {
  return (
    <SceneDisplay
      imageUrl={sceneImage}
      place={place}
      isHidden={isHidden}
      opacity="full"
      onImageLoad={onSceneReady}
    />
  );
}

type SceneReadyViewProps = {
  sceneImage: string | null;
  place: string;
  isHidden: boolean;
};

function SceneReadyView({ sceneImage, place, isHidden }: SceneReadyViewProps) {
  return <SceneDisplay imageUrl={sceneImage} place={place} isHidden={isHidden} opacity="full" />;
}

type QuizPhaseViewProps = {
  phase: Extract<ClientPhase, { kind: 'quiz' }>;
  currentProblem: ProblemWithStaticFlag;
  isAdminPromise: Promise<boolean>;
  isStaticProblem: boolean;
  isAudioBusy: boolean;
  editingIncorrectOptionKey: string | null;
  onChangeEditingIncorrectOption: Dispatch<SetStateAction<string | null>>;
  updateIncorrectOption: (
    incorrectIndex: number,
    nextText: string,
  ) => Promise<EditableIncorrectOptionResult>;
  onSelectOption: (selectedIndex: number) => void;
  onReplayAudio: () => void;
};

function QuizPhaseView({
  phase,
  currentProblem,
  isAdminPromise,
  isStaticProblem,
  isAudioBusy,
  editingIncorrectOptionKey,
  onChangeEditingIncorrectOption,
  updateIncorrectOption,
  onSelectOption,
  onReplayAudio,
}: QuizPhaseViewProps) {
  return (
    <Suspense>
      <QuizOptionsSection
        phase={phase}
        currentProblem={currentProblem}
        isAdminPromise={isAdminPromise}
        isStaticProblem={isStaticProblem}
        isAudioBusy={isAudioBusy}
        editingIncorrectOptionKey={editingIncorrectOptionKey}
        onChangeEditingIncorrectOption={onChangeEditingIncorrectOption}
        updateIncorrectOption={updateIncorrectOption}
        onSelectOption={onSelectOption}
        onReplayAudio={onReplayAudio}
      />
    </Suspense>
  );
}

type CorrectPhaseViewProps = {
  phase: Extract<ClientPhase, { kind: 'correct' }>;
  isOnStreak: boolean;
  length: ProblemLength;
  isAudioBusy: boolean;
  onNextProblem: () => void;
};

function CorrectPhaseView({
  phase,
  isOnStreak,
  length,
  isAudioBusy,
  onNextProblem,
}: CorrectPhaseViewProps) {
  return (
    <section className="grid text-center max-w-[500px] mx-auto">
      <div className="px-6 py-6 text-cyan-600">
        <h2 className="text-4xl font-bold flex justify-center items-center gap-4">
          <div className="transform scale-x-[-1]">🎉</div>
          {isOnStreak ? `${phase.setting.correctStreak}問連続 ` : ''} 正解<div>🎉</div>
        </h2>
        <div className="mt-6 flex justify-center max-w-[40%] sm:max-w-[160px] mx-auto relative">
          <Image
            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/correct1.webp`}
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
                const courseName = length.charAt(0).toUpperCase() + length.slice(1);
                const shareUrl = `${window.location.origin}?streak=${phase.setting.correctStreak}`;
                const tweetText = `【英語きわめ太郎】${courseName}コースで${phase.setting.correctStreak}問連続正解しました！`;
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
                window.open(twitterUrl, '_blank', 'width=550,height=420');
              }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-black px-6 py-3 text-base font-semibold text-white shadow-lg shadow-black/50 enabled:hover:bg-gray-800"
            >
              𝕏 で自慢する
            </button>
          )}
        </div>
        <p className="mt-4 text-2xl font-semibold text-[#2a2b3c]">
          {phase.problem.englishSentence}
        </p>
        <p className="mt-4 text-lg text-[#2a2b3c]">{phase.problem.japaneseSentence}</p>
      </div>
      <div className="">
        <button
          type="button"
          onClick={onNextProblem}
          className="inline-flex items-center justify-center rounded-full bg-[#d77a61] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#d77a61]/40 enabled:hover:bg-[#c3684f] disabled:opacity-60"
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
};

function IncorrectPhaseView({ isAudioBusy, onRetry }: IncorrectPhaseViewProps) {
  return (
    <section className="grid gap-2 text-center">
      <div className="px-6 py-6 text-blue-600">
        <h2 className="text-4xl font-bold pl-4">残念…</h2>
        <div className="mt-6 flex justify-center max-w-[40%] sm:max-w-[160px] mx-auto">
          <Image
            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/incorrect1.webp?1`}
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
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] bg-[#ffffff] px-6 py-3 text-base font-semibold text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:opacity-60"
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
  editingIncorrectOptionKey: string | null;
  onChangeEditingIncorrectOption: Dispatch<SetStateAction<string | null>>;
  updateIncorrectOption: (
    incorrectIndex: number,
    nextText: string,
  ) => Promise<EditableIncorrectOptionResult>;
  onSelectOption: (selectedIndex: number) => void;
  onReplayAudio: () => void;
};

function QuizOptionsSection({
  phase,
  currentProblem,
  isAdminPromise,
  isStaticProblem,
  isAudioBusy,
  editingIncorrectOptionKey,
  onChangeEditingIncorrectOption,
  updateIncorrectOption,
  onSelectOption,
  onReplayAudio,
}: QuizOptionsSectionProps) {
  const isAdmin = use(isAdminPromise);
  const canEditCurrentProblem = isAdmin && !isStaticProblem;

  return (
    <section className="grid pt-4 max-w-[500px] mx-auto">
      <div>
        <p className="text-center text-xl font-semibold text-[#2a2b3c] sm:text-2xl">
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
                  onCancel={() => onChangeEditingIncorrectOption(null)}
                  onSubmit={async (value) => {
                    const result = await updateIncorrectOption(option.incorrectIndex, value);
                    if (result.ok) {
                      onChangeEditingIncorrectOption(null);
                      return { ok: true as const };
                    }

                    return { ok: false as const, message: result.message };
                  }}
                />
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => onSelectOption(index)}
                    className={`w-full rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 ${canEditCurrentProblem ? 'pr-20' : 'pr-5'} text-left text-base font-medium text-[#2a2b3c] shadow-sm shadow-[#d8cbb6]/40 enabled:hover:border-[#2f8f9d] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d] disabled:opacity-50`}
                    disabled={isAudioBusy}
                  >
                    {option.text}
                  </button>
                  {canEditCurrentProblem &&
                    (option.kind === 'incorrect' ? (
                      <button
                        type="button"
                        onClick={() => onChangeEditingIncorrectOption(optionKey)}
                        className="absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-center justify-center rounded-tr-xl rounded-br-xl h-[100%] border border-[#2f8f9d] bg-white p-2 text-sm min-w-[4rem] font-semibold text-[#2f8f9d] shadow-sm enabled:hover:bg-[#2f8f9d] enabled:hover:text-[#f4f1ea]"
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
                        className="absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-center justify-center rounded-tr-xl rounded-br-xl h-[100%] border border-[#2f8f9d] bg-white p-2 text-sm min-w-[4rem] font-semibold text-[#2f8f9d] shadow-sm enabled:hover:bg-[#2f8f9d] enabled:hover:text-[#f4f1ea]"
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
      <div className="flex justify-center mt-6">
        <button
          type="button"
          onClick={onReplayAudio}
          className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 enabled:hover:bg-[#257682] disabled:opacity-60"
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
  sceneImage: string | null;
  currentProblem: ProblemWithStaticFlag;
  isDeletingProblem: boolean;
  onRemoveImage: () => void;
  onRemoveAudioEn: () => void;
  onRemoveAudioEnReply: () => void;
  onRemoveAudioJa: () => void;
  onDeleteProblem: () => void;
};

function AdminProblemActions({
  isAdminPromise,
  isStaticProblem,
  sceneImage,
  currentProblem,
  isDeletingProblem,
  onRemoveImage,
  onRemoveAudioEn,
  onRemoveAudioEnReply,
  onRemoveAudioJa,
  onDeleteProblem,
}: AdminProblemActionsProps) {
  const isAdmin = use(isAdminPromise);
  const canEditCurrentProblem = isAdmin && !isStaticProblem;

  if (!canEditCurrentProblem) return null;

  return (
    <div className="mt-160 flex flex-col items-center gap-6">
      {sceneImage && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onRemoveImage}
          className="inline-flex items-center justify-center rounded-full bg-rose-600 px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-rose-900/30 transition enabled:hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          この問題の画像を削除
        </button>
      )}
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          tabIndex={-1}
          onClick={onRemoveAudioEn}
          disabled={!currentProblem.audioEnUrl}
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-sky-900/30 transition enabled:hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          英語音声を削除する
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={onRemoveAudioEnReply}
          disabled={!currentProblem.audioEnReplyUrl}
          className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-indigo-900/30 transition enabled:hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          英語返答音声を削除する
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={onRemoveAudioJa}
          disabled={!currentProblem.audioJaUrl}
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-emerald-900/30 transition enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          日本語返答音声を削除する
        </button>
      </div>
      <button
        type="button"
        tabIndex={-1}
        onClick={onDeleteProblem}
        disabled={isDeletingProblem}
        className="inline-flex items-center justify-center rounded-full bg-red-700 px-6 py-3 text-base font-semibold text-[#f4f1ea] shadow-lg shadow-red-900/30 transition enabled:hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeletingProblem ? '削除中…' : 'この問題自体を削除する'}
      </button>
    </div>
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
      className="w-full rounded-2xl border border-[#d8cbb6] bg-[#ffffff] px-5 py-4 text-left shadow-sm shadow-[#d8cbb6]/40"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          {...register('text')}
          autoFocus
          disabled={isSubmitting}
          className="flex-1 rounded-xl border border-[#d8cbb6] px-4 py-2 text-base text-[#2a2b3c] shadow-sm focus:border-[#2f8f9d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8f9d]"
        />
        <div className="flex gap-2 sm:justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-4 py-2 text-sm font-semibold text-[#f4f1ea] shadow enabled:hover:bg-[#257682] disabled:opacity-60"
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
            className="inline-flex items-center justify-center rounded-full border border-[#d8cbb6] px-4 py-2 text-sm font-semibold text-[#2a2b3c] shadow-sm enabled:hover:border-[#d77a61] enabled:hover:text-[#d77a61] disabled:opacity-60"
          >
            キャンセル
          </button>
        </div>
      </div>
      {(errors.text || errors.root) && (
        <p className="mt-2 text-sm text-rose-600">{errors.text?.message ?? errors.root?.message}</p>
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
}: {
  imageUrl: string | null;
  place: string;
  isHidden: boolean;
  opacity: 'medium' | 'full';
  onImageLoad?: () => void;
}) {
  if (imageUrl && !isHidden) {
    return (
      <section className="grid place-items-center">
        <figure className="flex w-full justify-center">
          <SceneImage
            src={imageUrl}
            alt="英語と日本語のセリフを並べた2コマシーン"
            opacity={opacity}
            onLoad={onImageLoad}
          />
        </figure>
      </section>
    );
  }

  return (
    <section className="grid place-items-center">
      <div className="w-full max-w-[500px] p-6 text-center text-[#2a2b3c] leading-relaxed bg-white rounded-lg border border-[#d8cbb6]">
        <h3 className="font-semibold mb-3 text-lg text-[#2f8f9d]">シーン</h3>
        <p className="font-bold text-2xl">{place}</p>
      </div>
    </section>
  );
}
