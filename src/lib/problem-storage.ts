import type { Prisma, Problem } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const RANDOM_SAMPLE_SIZE = Number(process.env.PROBLEM_CACHE_SAMPLE_SIZE ?? '20');
const AUTO_APPROVE_NEW_PROBLEMS = true;

export type SpeakerLabel = 'male' | 'female' | 'neutral';

// Prismaの型を拡張して使用
type ProblemWithStringArray = Omit<Problem, 'incorrectOptions'> & {
  incorrectOptions: string[];
};

export type PersistGeneratedProblemInput = {
  problem: Omit<
    ProblemWithStringArray,
    'id' | 'createdAt' | 'updatedAt' | 'audioEnUrl' | 'audioJaUrl' | 'audioEnReplyUrl' | 'imageUrl'
  >;
  assets: {
    imageUrl: string | null;
    audio: {
      english: string;
      japanese: string | null;
      englishReply?: string | null;
    };
  };
};

export type CachedProblemResponse = {
  problem: ProblemWithStringArray;
  assets: {
    imageUrl: string | null;
    audio: {
      english: string;
      japanese: string;
      englishReply?: string;
    };
  };
};

type ProblemRecord = Problem;

type FetchOptions = {
  requireQualityCheck?: boolean;
};

function parseIncorrectOptions(value: Problem['incorrectOptions']): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function mapRecordToResponse(record: ProblemRecord | null): CachedProblemResponse | null {
  if (!record) {
    return null;
  }

  const incorrectOptions = parseIncorrectOptions(record.incorrectOptions);

  return {
    problem: {
      ...record,
      incorrectOptions, // JsonValueから変換したstring[]
    },
    assets: {
      imageUrl: record.imageUrl || null,
      audio: {
        english: record.audioEnUrl || '',
        japanese: record.audioJaUrl || '',
        englishReply: record.audioEnReplyUrl || '',
      },
    },
  };
}

export async function saveGeneratedProblem(
  input: PersistGeneratedProblemInput,
): Promise<CachedProblemResponse | null> {
  const problemData = {
    wordCount: input.problem.wordCount,
    englishSentence: input.problem.englishSentence,
    japaneseSentence: input.problem.japaneseSentence,
    japaneseReply: input.problem.japaneseReply,
    englishReply: input.problem.englishReply || '',
    incorrectOptions: input.problem.incorrectOptions,
    audioEnUrl: input.assets.audio.english,
    audioJaUrl: input.assets.audio.japanese || null,
    audioEnReplyUrl: input.assets.audio.englishReply || null,
    imageUrl: input.assets.imageUrl,
    senderVoice: input.problem.senderVoice,
    senderRole: input.problem.senderRole,
    receiverVoice: input.problem.receiverVoice,
    receiverRole: input.problem.receiverRole,
    place: input.problem.place,
  } as const;

  const record = await prisma.problem.create({
    data: problemData,
  });

  return mapRecordToResponse(record);
}

export async function fetchCachedProblem(
  length: 'short' | 'medium' | 'long',
  options: FetchOptions = {},
): Promise<CachedProblemResponse | null> {
  let wordCountRange: { gte?: number; lte?: number };

  switch (length) {
    case 'short':
      wordCountRange = { lte: 3 };
      break;
    case 'medium':
      wordCountRange = { gte: 4, lte: 8 };
      break;
    case 'long':
      wordCountRange = { gte: 9 };
      break;
  }

  const where: Prisma.ProblemWhereInput = {
    wordCount: wordCountRange,
  };

  const total = await prisma.problem.count({ where });
  console.log(`[fetchCachedProblem] ${length}タイプの問題数: ${total}`);

  if (total === 0) {
    return null;
  }

  const take = Math.min(RANDOM_SAMPLE_SIZE, total);
  const maxSkip = Math.max(total - take, 0);
  const skip = maxSkip > 0 ? Math.floor(Math.random() * (maxSkip + 1)) : 0;

  console.log(`[fetchCachedProblem] skip: ${skip}, take: ${take}`);

  const records = await prisma.problem.findMany({
    where,
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
    `[fetchCachedProblem] ${records.length}件中${chosenIndex}番目を選択: "${chosen.englishSentence}"`,
  );

  return mapRecordToResponse(chosen);
}
