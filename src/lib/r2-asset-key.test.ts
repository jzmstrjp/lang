import { describe, expect, it } from 'vitest';
import { R2AudioKey, R2ImageKey } from './r2-asset-key.js';

const NOW = new Date('2026-05-02T05:00:00.000Z'); // 2026-05-02, getTime() = 1746162000000

describe('R2AudioKey', () => {
  it('正しいパス形式になる', () => {
    const key = new R2AudioKey('problem-1', 'en', 'male', NOW);
    expect(key.value).toMatch(/^audio\/2026-05-02\/problem-1_en_male_[0-9a-z]+\.mp3$/);
  });

  it('同じ引数でも時刻が違えば異なるキーになる', () => {
    const key1 = new R2AudioKey('problem-1', 'en', 'male', new Date('2026-05-02T05:00:00.000Z'));
    const key2 = new R2AudioKey('problem-1', 'en', 'male', new Date('2026-05-02T05:00:01.000Z'));
    expect(key1.value).not.toBe(key2.value);
  });

  it('空のproblemIdは不正', () => {
    expect(() => new R2AudioKey('', 'en', 'male', NOW)).toThrow();
  });

  it('パストラバーサルは不正', () => {
    expect(() => new R2AudioKey('../etc/passwd', 'en', 'male', NOW)).toThrow();
  });
});

describe('R2ImageKey', () => {
  it('png: 正しいパス形式になる', () => {
    const key = new R2ImageKey('problem-1', 'png', NOW);
    expect(key.value).toMatch(/^images\/2026-05-02\/problem-1_composite_[0-9a-z]+\.png$/);
  });

  it('webp: 正しいパス形式になる', () => {
    const key = new R2ImageKey('problem-1', 'webp', NOW);
    expect(key.value).toMatch(/^images\/2026-05-02\/problem-1_composite_[0-9a-z]+\.webp$/);
  });

  it('同じ引数でも時刻が違えば異なるキーになる', () => {
    const key1 = new R2ImageKey('problem-1', 'png', new Date('2026-05-02T05:00:00.000Z'));
    const key2 = new R2ImageKey('problem-1', 'png', new Date('2026-05-02T05:00:01.000Z'));
    expect(key1.value).not.toBe(key2.value);
  });

  it('空のproblemIdは不正', () => {
    expect(() => new R2ImageKey('', 'png', NOW)).toThrow();
  });

  it('パストラバーサルは不正', () => {
    expect(() => new R2ImageKey('../etc/passwd', 'png', NOW)).toThrow();
  });
});
