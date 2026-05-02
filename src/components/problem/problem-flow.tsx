'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ProblemWithAudio } from '@/app/api/problems/route';
import { SceneImage } from '@/components/ui/scene-image';
import { StartButton } from '@/components/ui/start-button';
import { shuffleOptionsWithCorrectIndex, type ShuffledQuizOption } from '@/lib/shuffle-utils';
import { ALLOWED_SHARE_COUNTS, CDN_ORIGIN } from '@/const';
import { ArrowLeft, ExternalLink, Pencil, RotateCw, Wrench, X } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { type ProblemLength, type DifficultyLevel } from '@/config/problem';

type ServerPhase = {
  problem: ProblemWithAudio;
} & {
  kind: 'start-button-server';
};

type ClientPhase = {
  setting: Setting;
  problem: ProblemWithAudio;
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

export type { ProblemLength, DifficultyLevel };

type ProblemFlowProps = {
  length?: ProblemLength;
  difficultyLevel?: DifficultyLevel;
  initialProblem: ProblemWithAudio;
  isAdminPromise: Promise<boolean>;
  includeNullDifficulty?: boolean;
  latestDays?: number;
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
  latestDays,
  includeNullDifficulty = false,
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
  const [problemQueue, setProblemQueue] = useState<ProblemWithAudio[]>([]);
  const [isAudioBusy, setAudioBusy] = useState(false);
  const [isDeletingProblem, setDeletingProblem] = useState(false);
  const [isImprovingTranslation, setImprovingTranslation] = useState(false);
  const [isRegeneratingReply, setRegeneratingReply] = useState(false);
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
        if (includeNullDifficulty) {
          params.set('includeNullDifficulty', 'true');
        }
      }
      if (latestDays !== undefined) {
        params.set('latest', String(latestDays));
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
  }, [difficultyLevel, length, problemQueue.length, includeNullDifficulty, latestDays]);

  // phaseごとの処理
  useLayoutEffect(() => {
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

      if (responseData[field]) {
        const sentence = currentProblem.englishSentence;
        window.location.href = `${pathname}?search=${encodeURIComponent(sentence)}`;
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
        const updatedProblem: ProblemWithAudio = {
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
            ? ({ ...problem, japaneseSentence: newJapaneseSentence } as ProblemWithAudio)
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

  const handleRegenerateReply = async () => {
    if (isRegeneratingReply) {
      return;
    }

    const targetProblemId = currentProblem?.id;
    const japaneseSentence = currentProblem?.japaneseSentence;
    const currentJapaneseReply = currentProblem?.japaneseReply;

    if (!targetProblemId || !currentJapaneseReply) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    setRegeneratingReply(true);

    try {
      // AI で englishReply + japaneseReply を再生成
      const regenerateResponse = await fetch('/api/admin/problems/regenerate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: targetProblemId }),
      });

      if (!regenerateResponse.ok) {
        const data = await regenerateResponse.json().catch(() => null);
        window.alert(data?.error ?? '返答の再生成に失敗しました。');
        return;
      }

      const regenerateData = await regenerateResponse.json();
      const newEnglishReply = regenerateData.englishReply as string;
      const newJapaneseReply = regenerateData.japaneseReply as string;

      if (!newEnglishReply || !newJapaneseReply) {
        window.alert('返答の再生成に失敗しました。');
        return;
      }

      // confirm ダイアログで新しい返答を提示
      const confirmed = window.confirm(
        `「${japaneseSentence}」\nに対する返答を以下の内容に変更しますか？\n\n【日本語】\n「${currentJapaneseReply}」\n↓\n「${newJapaneseReply}」\n【英語】\n「${newEnglishReply}」`,
      );

      if (!confirmed) {
        return;
      }

      // DB を更新
      const updateResponse = await fetch('/api/admin/problems/update-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: targetProblemId,
          englishReply: newEnglishReply,
          japaneseReply: newJapaneseReply,
        }),
      });

      if (!updateResponse.ok) {
        const data = await updateResponse.json().catch(() => null);
        window.alert(data?.error ?? '返答の更新に失敗しました。');
        return;
      }

      // 英語返答音声を再生成
      const audioEnReplyResponse = await fetch('/api/admin/problems/regenerate-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: targetProblemId, field: 'audioEnReplyUrl' }),
      });

      if (!audioEnReplyResponse.ok) {
        const data = await audioEnReplyResponse.json().catch(() => null);
        window.alert(data?.error ?? '英語返答音声の再生成に失敗しました。');
        return;
      }

      // 日本語返答音声を再生成
      const audioJaResponse = await fetch('/api/admin/problems/regenerate-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: targetProblemId, field: 'audioJaUrl' }),
      });

      if (!audioJaResponse.ok) {
        const data = await audioJaResponse.json().catch(() => null);
        window.alert(data?.error ?? '日本語返答音声の再生成に失敗しました。');
        return;
      }

      // ページをリロード
      const sentence = currentProblem.englishSentence;
      window.location.href = `${pathname}?search=${encodeURIComponent(sentence)}`;
    } catch (error) {
      console.error('[ProblemFlow] 返答再生成エラー:', error);
      if (typeof window !== 'undefined') {
        window.alert('返答の再生成中にエラーが発生しました。');
      }
    } finally {
      setRegeneratingReply(false);
    }
  };

  const updateIncorrectOption = async (
    incorrectIndex: number,
    nextText: string,
  ): Promise<EditableIncorrectOptionResult> => {
    const problemId = currentProblem?.id;

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
        />
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

      <Suspense fallback={null}>
        {isAdminModalOpen ? (
          <AdminProblemActions
            isAdminPromise={isAdminPromise}
            isDeletingProblem={isDeletingProblem}
            isImprovingTranslation={isImprovingTranslation}
            isRegeneratingReply={isRegeneratingReply}
            regeneratingAssetRef={regeneratingAssetRef}
            onRegenerateImage={handleRegenerateImage}
            onRegenerateAudioEn={handleRegenerateAudioEn}
            onRegenerateAudioEnReply={handleRegenerateAudioEnReply}
            onRegenerateAudioJa={handleRegenerateAudioJa}
            onDeleteProblem={handleDeleteProblem}
            onImproveTranslation={handleImproveTranslation}
            onRegenerateReply={handleRegenerateReply}
            isModalOpen={isAdminModalOpen}
            onClose={() => setAdminModalOpen(false)}
          />
        ) : null}
      </Suspense>

      <Suspense fallback={null}>
        <FixedAdminButton
          isAdminPromise={isAdminPromise}
          isAdminModalOpen={isAdminModalOpen}
          onOpenAdminModal={() => setAdminModalOpen(true)}
          onCloseAdminModal={() => setAdminModalOpen(false)}
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
  currentProblem: ProblemWithAudio;
  isAdminPromise: Promise<boolean>;
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
  isAudioBusy,
  updateIncorrectOption,
  onSelectOption,
  onReplayAudio,
  onRetry,
}: QuizPhaseViewProps) {
  return (
    <QuizOptionsSection
      key={phase.problem.id}
      phase={phase}
      currentProblem={currentProblem}
      isAdminPromise={isAdminPromise}
      isAudioBusy={isAudioBusy}
      updateIncorrectOption={updateIncorrectOption}
      onSelectOption={onSelectOption}
      onReplayAudio={onReplayAudio}
      onRetry={onRetry}
    />
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
            src={`${CDN_ORIGIN}/correct${imageVariant}.webp`}
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
            src={`${CDN_ORIGIN}/incorrect${imageVariant}.webp`}
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
  currentProblem: ProblemWithAudio;
  isAdminPromise: Promise<boolean>;
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
  isAudioBusy,
  updateIncorrectOption,
  onSelectOption,
  onReplayAudio,
  onRetry,
}: QuizOptionsSectionProps) {
  const [editingIncorrectOptionKey, setEditingIncorrectOptionKey] = useState<string | null>(null);

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
                    className={`w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-5 py-4 text-left text-base font-medium text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--primary)] enabled:hover:shadow-md enabled:active:translate-y-[1px] enabled:active:shadow-inner disabled:opacity-40`}
                    disabled={isAudioBusy}
                  >
                    {option.text}
                  </button>
                  <Suspense fallback={null}>
                    <AdminOptionEditButton
                      isAdminPromise={isAdminPromise}
                      option={option}
                      onStartEdit={() => setEditingIncorrectOptionKey(optionKey)}
                    />
                  </Suspense>
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
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] p-3 text-base font-semibold text-[var(--text)] shadow-sm shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)] disabled:opacity-30"
          disabled={!phase.problem.audioEnUrl || isAudioBusy}
          aria-label="もう一度聞く"
        >
          <RotateCw className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

type AdminOptionEditButtonProps = {
  isAdminPromise: Promise<boolean>;
  option: ShuffledQuizOption;
  onStartEdit: () => void;
};

function AdminOptionEditButton({
  isAdminPromise,
  option,
  onStartEdit,
}: AdminOptionEditButtonProps) {
  const isAdmin = use(isAdminPromise);

  if (!isAdmin) return null;

  return option.kind === 'incorrect' ? (
    <button
      type="button"
      onClick={onStartEdit}
      tabIndex={-1}
      className="absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-end justify-end rounded-tr-2xl rounded-br-2xl h-[100%] border border-[var(--primary)]/40 bg-[var(--background)]/40 p-2 text-sm min-w-[2rem] font-semibold text-[var(--primary)] shadow-sm enabled:hover:bg-[var(--primary)] enabled:hover:text-[var(--primary-text)]"
    >
      <Pencil size={16} />
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
      className="absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-end justify-end rounded-tr-2xl rounded-br-2xl h-[100%] border border-[var(--primary)]/40 bg-[var(--background)]/40 p-2 text-sm min-w-[2rem] font-semibold text-[var(--primary)] shadow-sm enabled:hover:bg-[var(--primary)] enabled:hover:text-[var(--primary-text)]"
    >
      <Pencil size={16} />
    </button>
  );
}

type AdminProblemActionsProps = {
  isAdminPromise: Promise<boolean>;
  isDeletingProblem: boolean;
  isImprovingTranslation: boolean;
  isRegeneratingReply: boolean;
  regeneratingAssetRef: React.MutableRefObject<Record<RemovableField, boolean>>;
  onRegenerateImage: () => void;
  onRegenerateAudioEn: () => void;
  onRegenerateAudioEnReply: () => void;
  onRegenerateAudioJa: () => void;
  onDeleteProblem: () => void;
  onImproveTranslation: () => void;
  onRegenerateReply: () => void;
  isModalOpen: boolean;
  onClose: () => void;
};

function AdminProblemActions({
  isAdminPromise,
  isDeletingProblem,
  isImprovingTranslation,
  isRegeneratingReply,
  regeneratingAssetRef,
  onRegenerateImage,
  onRegenerateAudioEn,
  onRegenerateAudioEnReply,
  onRegenerateAudioJa,
  onDeleteProblem,
  onImproveTranslation,
  onRegenerateReply,
  isModalOpen,
  onClose,
}: AdminProblemActionsProps) {
  const isAdmin = use(isAdminPromise);
  const [, forceUpdate] = useState({});

  // refの変更を検知するために定期的にチェック
  useEffect(() => {
    if (!isModalOpen) return;

    const interval = setInterval(() => {
      forceUpdate({});
    }, 100);

    return () => clearInterval(interval);
  }, [isModalOpen]);

  if (!isAdmin || !isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="管理者向け機能"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--dialog-background)] p-6 shadow-2xl shadow-black/40">
        <div className="space-y-8">
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
          <button
            type="button"
            onClick={onRegenerateReply}
            disabled={isRegeneratingReply}
            className="inline-flex w-full items-center justify-center rounded-full bg-orange-500 px-6 py-3 text-base font-semibold text-[var(--primary-text)] shadow-lg shadow-orange-500/30 transition enabled:hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isRegeneratingReply ? '再生成中…' : '返答全体を再生成する'}
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
      </div>
    </div>
  );
}

type FixedAdminButtonProps = {
  isAdminPromise: Promise<boolean>;
  isAdminModalOpen: boolean;
  onOpenAdminModal: () => void;
  onCloseAdminModal: () => void;
};

function FixedAdminButton({
  isAdminPromise,
  isAdminModalOpen,
  onOpenAdminModal,
  onCloseAdminModal,
}: FixedAdminButtonProps) {
  const isAdmin = use(isAdminPromise);

  if (!isAdmin) return null;

  return (
    <button
      type="button"
      onClick={isAdminModalOpen ? onCloseAdminModal : onOpenAdminModal}
      tabIndex={-1}
      className="fixed bottom-4 left-4 z-50 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] h-13 w-13 text-base font-semibold text-[var(--text)] shadow-lg shadow-[var(--border)]/40 enabled:hover:border-[var(--secondary)] enabled:hover:text-[var(--secondary)]"
      aria-label={isAdminModalOpen ? '管理機能を閉じる' : '管理機能を開く'}
    >
      {isAdminModalOpen ? <X className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
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
      <div className="flex flex-col gap-3">
        <textarea
          {...register('text')}
          autoFocus
          disabled={isSubmitting}
          className="rounded-xl border border-[var(--border)] -mx-1 px-3 py-2 text-base text-[var(--text)] shadow-sm resize-none w-[102%]"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <div className="flex gap-2 justify-end">
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-text)] shadow enabled:hover:bg-[var(--primary-hover)] disabled:opacity-30"
          >
            {isSubmitting ? '更新中…' : '更新'}
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
