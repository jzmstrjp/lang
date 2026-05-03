import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { generateSpeechBuffer } from '@/lib/audio-utils';
import { uploadAudioToR2 } from '@/lib/r2-client';
import { generateAndUploadImageAsset } from '@/lib/problem-generator';
import { cdnUrl } from '@/const';
import type { VoiceGender } from '@/config/voice';
import type { GeneratedProblem } from '@/types/generated-problem';

// 画像再生成は数十秒かかることがあるので、Vercel Hobby 上限の 60 秒まで許可する
export const maxDuration = 60;

type RequestBody = {
  problemId?: string;
  field?: RegenerableField;
};

const regenerableFields = ['imageUrl', 'audioEnUrl', 'audioEnReplyUrl', 'audioJaUrl'] as const;
type RegenerableField = (typeof regenerableFields)[number];

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const problemId = body.problemId;
    const field = body.field ?? 'imageUrl';

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json({ error: 'problemId が不正です。' }, { status: 400 });
    }

    if (!regenerableFields.includes(field)) {
      return NextResponse.json({ error: '再生成対象フィールドが不正です。' }, { status: 400 });
    }

    // 問題をDBから取得
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    const senderVoiceGender = problem.senderVoice as VoiceGender;
    const receiverVoiceGender = problem.receiverVoice as VoiceGender;

    let newUrl: string;
    const updateData: Prisma.ProblemUpdateInput = {};

    switch (field) {
      case 'imageUrl': {
        console.log(`[regenerate-asset] 画像を再生成中: ${problemId}`);
        const generatedProblem: GeneratedProblem = {
          wordCount: problem.wordCount,
          englishSentence: problem.englishSentence,
          japaneseSentence: problem.japaneseSentence,
          japaneseReply: problem.japaneseReply,
          englishReply: problem.englishReply,
          incorrectOptions: (Array.isArray(problem.incorrectOptions)
            ? problem.incorrectOptions
            : []) as string[],
          senderVoice: problem.senderVoice as 'male' | 'female',
          senderRole: problem.senderRole,
          receiverVoice: problem.receiverVoice as 'male' | 'female',
          receiverRole: problem.receiverRole,
          place: problem.place,
          scenePrompt: problem.scenePrompt,
          senderVoiceInstruction: problem.senderVoiceInstruction,
          receiverVoiceInstruction: problem.receiverVoiceInstruction,
          difficultyLevel: problem.difficultyLevel ?? null,
        };
        newUrl = await generateAndUploadImageAsset(generatedProblem, problemId);
        updateData.imageUrl = newUrl;
        break;
      }

      case 'audioEnUrl': {
        console.log(`[regenerate-asset] 英語音声を再生成中: ${problemId}`);
        const audioBuffer = await generateSpeechBuffer(
          problem.englishSentence,
          senderVoiceGender,
          'en',
          problem.senderVoiceInstruction,
          problem.senderRole,
        );
        newUrl = await uploadAudioToR2(audioBuffer, problemId, 'en', senderVoiceGender);
        updateData.audioEnUrl = newUrl;
        break;
      }

      case 'audioEnReplyUrl': {
        if (!problem.englishReply) {
          return NextResponse.json(
            { error: 'この問題には英語返答がありません。' },
            { status: 400 },
          );
        }
        console.log(`[regenerate-asset] 英語返答音声を再生成中: ${problemId}`);
        const audioBuffer = await generateSpeechBuffer(
          problem.englishReply,
          receiverVoiceGender,
          'en',
          problem.receiverVoiceInstruction,
          problem.receiverRole,
        );
        newUrl = await uploadAudioToR2(audioBuffer, problemId, 'en-reply', receiverVoiceGender);
        updateData.audioEnReplyUrl = newUrl;
        break;
      }

      case 'audioJaUrl': {
        console.log(`[regenerate-asset] 日本語返答音声を再生成中: ${problemId}`);
        const audioBuffer = await generateSpeechBuffer(
          problem.japaneseReply,
          receiverVoiceGender,
          'ja',
          problem.receiverVoiceInstruction,
          problem.receiverRole,
        );
        newUrl = await uploadAudioToR2(audioBuffer, problemId, 'ja', receiverVoiceGender);
        updateData.audioJaUrl = newUrl;
        break;
      }

      default:
        return NextResponse.json({ error: '再生成対象フィールドが不正です。' }, { status: 400 });
    }

    // DBを更新
    await prisma.problem.update({
      where: { id: problemId },
      data: updateData,
    });

    console.log(`[regenerate-asset] ${field} 再生成完了: ${newUrl}`);

    return NextResponse.json({
      success: true,
      [field]: cdnUrl(newUrl),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    console.error('[regenerate-asset] エラーが発生しました', error);
    return NextResponse.json({ error: 'アセットの再生成に失敗しました。' }, { status: 500 });
  }
}
