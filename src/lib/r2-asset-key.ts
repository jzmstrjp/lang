import type { VoiceGender } from '../config/voice';

export abstract class R2AssetKey {
  readonly value: string;

  protected constructor(value: string) {
    if (value.includes('..')) {
      throw new Error('R2AssetKey: パストラバーサルは不正です');
    }
    this.value = value;
  }

  protected static validateProblemId(problemId: string): void {
    if (!problemId || problemId.trim() === '') {
      throw new Error('R2AssetKey: problemId が空です');
    }
  }

  protected static timeComponents(now: Date): { date: string; timeHash: string } {
    return {
      date: now.toISOString().slice(0, 10),
      timeHash: now.getTime().toString(36),
    };
  }
}

export class R2AudioKey extends R2AssetKey {
  constructor(
    problemId: string,
    language: 'en' | 'ja' | 'en-reply',
    speaker: VoiceGender,
    now: Date = new Date(),
  ) {
    R2AssetKey.validateProblemId(problemId);
    const { date, timeHash } = R2AssetKey.timeComponents(now);
    super(`audio/${date}/${problemId}_${language}_${speaker}_${timeHash}.mp3`);
  }
}

export class R2ImageKey extends R2AssetKey {
  constructor(problemId: string, format: 'png' | 'webp', now: Date = new Date()) {
    R2AssetKey.validateProblemId(problemId);
    const { date, timeHash } = R2AssetKey.timeComponents(now);
    super(`images/${date}/${problemId}_composite_${timeHash}.${format}`);
  }
}
