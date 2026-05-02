import { describe, expect, it } from 'vitest';
import { ProblemPageParams } from './problem-page-params.js';

const sp = (init: Record<string, string>) => new URLSearchParams(init);

describe('ProblemPageParams', () => {
  describe('除外リスト', () => {
    it('subtitle は常に除外される', () => {
      const params = new ProblemPageParams(sp({ subtitle: 'true', latest: '7' }));
      expect(params.value).not.toContain('subtitle');
      expect(params.value).toContain('latest=7');
    });

    it('search は常に除外される', () => {
      const params = new ProblemPageParams(sp({ search: 'hello', latest: '7' }));
      expect(params.value).not.toContain('search');
      expect(params.value).toContain('latest=7');
    });
  });

  describe('引き継ぎ', () => {
    it('latest は引き継がれる', () => {
      const params = new ProblemPageParams(sp({ latest: '14' }));
      expect(params.value).toBe('?latest=14');
    });

    it('除外リスト以外の未知のパラメータも引き継がれる', () => {
      const params = new ProblemPageParams(sp({ foo: 'bar', latest: '7' }));
      expect(params.value).toContain('foo=bar');
      expect(params.value).toContain('latest=7');
    });

    it('パラメータが何もない場合は空文字列', () => {
      const params = new ProblemPageParams(sp({}));
      expect(params.value).toBe('');
    });

    it('除外リストのみの場合も空文字列', () => {
      const params = new ProblemPageParams(sp({ subtitle: 'true', search: 'hello' }));
      expect(params.value).toBe('');
    });
  });

  describe('overrides（除外リストより強い）', () => {
    it('search を overrides で指定すると復活する', () => {
      const params = new ProblemPageParams(sp({ search: 'old', latest: '7' }), { search: 'new' });
      expect(params.value).toContain('search=new');
      expect(params.value).toContain('latest=7');
    });

    it('subtitle を overrides で指定すると復活する', () => {
      const params = new ProblemPageParams(sp({ subtitle: 'true' }), { subtitle: 'true' });
      expect(params.value).toContain('subtitle=true');
    });

    it('overrides で undefined を渡すと該当パラメータが削除される', () => {
      const params = new ProblemPageParams(sp({ latest: '7', foo: 'bar' }), { latest: undefined });
      expect(params.value).not.toContain('latest');
      expect(params.value).toContain('foo=bar');
    });
  });

  describe('toString()', () => {
    it('テンプレートリテラルで使える', () => {
      const params = new ProblemPageParams(sp({ latest: '7' }));
      expect(`/problems/short${params}`).toBe('/problems/short?latest=7');
    });

    it('パラメータなしの場合はパスのみになる', () => {
      const params = new ProblemPageParams(sp({}));
      expect(`/problems/short${params}`).toBe('/problems/short');
    });
  });
});
