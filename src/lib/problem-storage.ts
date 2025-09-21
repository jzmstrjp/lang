import type { InteractionIntent, Prisma, Problem, ProblemAsset, ProblemType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const RANDOM_SAMPLE_SIZE = Number(process.env.PROBLEM_CACHE_SAMPLE_SIZE ?? '20');
const AUTO_APPROVE_NEW_PROBLEMS = process.env.AUTO_APPROVE_PROBLEMS === 'true';

export type SpeakerLabel = 'male' | 'female' | 'neutral';

export type PersistGeneratedProblemInput = {
  problem: {
    type: ProblemType;
    english: string;
    japaneseReply: string;
    options: string[];
    correctIndex: number;
    sceneId: string;
    scenePrompt: string;
    nuance?: string | null;
    genre?: string | null;
    patternGroup?: string | null;
    wordCount: number;
    interactionIntent: InteractionIntent;
    speakers: {
      character1: SpeakerLabel;
      character2: SpeakerLabel;
    };
  };
  assets: {
    composite: string | null;
    audio: {
      english: string;
      japanese: string | null;
    };
  };
};

export type CachedProblemResponse = {
  problem: {
    id: string;
    type: ProblemType;
    english: string;
    japaneseReply: string;
    options: string[];
    correctIndex: number;
    nuance: string;
    genre: string;
    scenePrompt: string;
    speakers: {
      character1: SpeakerLabel;
      character2: SpeakerLabel;
    };
    wordCount: number;
    interactionIntent: InteractionIntent;
  };
  assets: {
    composite: string | null;
    audio: {
      english: string;
      japanese: string;
    };
  };
};

type ProblemRecord = Problem & { asset: ProblemAsset | null };

type FetchOptions = {
  requireQualityCheck?: boolean;
};

const DEFAULT_GENRE = 'general';
const DEFAULT_NUANCE = 'neutral';

function toStringArray(value: Problem['options']): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return [];
}

function mapRecordToResponse(record: ProblemRecord | null): CachedProblemResponse | null {
  if (!record || !record.asset) {
    return null;
  }

  const options = toStringArray(record.options);
  if (!options.length) {
    return null;
  }

  return {
    problem: {
      id: record.id,
      type: record.type,
      english: record.english,
      japaneseReply: record.japaneseReply,
      options,
      correctIndex: record.correctIndex,
      nuance: record.nuance ?? DEFAULT_NUANCE,
      genre: record.genre ?? DEFAULT_GENRE,
      scenePrompt: record.scenePrompt,
      speakers: {
        character1: (record.speakersSceneA as SpeakerLabel) ?? 'neutral',
        character2: (record.speakersSceneB as SpeakerLabel) ?? 'neutral',
      },
      wordCount: record.wordCount,
      interactionIntent: record.interactionIntent,
    },
    assets: {
      composite: record.asset.compositeImage || null,
      audio: {
        english: record.asset.audioEn,
        japanese: record.asset.audioJa,
      },
    },
  };
}

export async function saveGeneratedProblem(
  input: PersistGeneratedProblemInput,
): Promise<CachedProblemResponse | null> {
  const uniqueWhere = {
    english_interactionIntent_sceneId: {
      english: input.problem.english,
      interactionIntent: input.problem.interactionIntent,
      sceneId: input.problem.sceneId,
    },
  };

  const baseData = {
    type: input.problem.type,
    english: input.problem.english,
    japaneseReply: input.problem.japaneseReply,
    options: input.problem.options,
    correctIndex: input.problem.correctIndex,
    sceneId: input.problem.sceneId,
    scenePrompt: input.problem.scenePrompt,
    speakersSceneA: input.problem.speakers.character1,
    speakersSceneB: input.problem.speakers.character2,
    nuance: input.problem.nuance ?? null,
    genre: input.problem.genre ?? null,
    patternGroup: input.problem.patternGroup ?? null,
    wordCount: input.problem.wordCount,
    interactionIntent: input.problem.interactionIntent,
    isCached: true,
    qualityCheck: AUTO_APPROVE_NEW_PROBLEMS,
  } as const;

  const assetData = {
    scenePrompt: input.problem.scenePrompt,
    compositeImage: input.assets.composite,
    audioEn: input.assets.audio.english,
    audioJa: input.assets.audio.japanese || '',
  };

  const record = await prisma.problem.upsert({
    where: uniqueWhere,
    create: {
      ...baseData,
      asset: {
        create: assetData,
      },
    },
    update: {
      ...baseData,
      asset: {
        upsert: {
          update: assetData,
          create: assetData,
        },
      },
    },
    include: {
      asset: true,
    },
  });

  return mapRecordToResponse(record);
}

export async function fetchCachedProblem(
  type: ProblemType,
  options: FetchOptions = {},
): Promise<CachedProblemResponse | null> {
  const where: Prisma.ProblemWhereInput = {
    type,
    isCached: true,
    ...(options.requireQualityCheck === false ? {} : { qualityCheck: true }),
  };

  const total = await prisma.problem.count({ where });
  console.log(`[fetchCachedProblem] ${type}タイプの問題数: ${total}`);

  if (total === 0) {
    return null;
  }

  const take = Math.min(RANDOM_SAMPLE_SIZE, total);
  const maxSkip = Math.max(total - take, 0);
  const skip = maxSkip > 0 ? Math.floor(Math.random() * (maxSkip + 1)) : 0;

  console.log(`[fetchCachedProblem] skip: ${skip}, take: ${take}`);

  const records = await prisma.problem.findMany({
    where,
    include: { asset: true },
    orderBy: { updatedAt: 'desc' },
    take,
    skip,
  });

  if (!records.length) {
    return null;
  }

  const chosenIndex = Math.floor(Math.random() * records.length);
  const chosen = records[chosenIndex];
  console.log(
    `[fetchCachedProblem] ${records.length}件中${chosenIndex}番目を選択: "${chosen.english}"`,
  );

  return mapRecordToResponse(chosen);
}
