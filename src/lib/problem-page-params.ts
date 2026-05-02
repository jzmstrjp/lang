import type { ReadonlyURLSearchParams } from 'next/navigation';

const EXCLUDED_PARAMS = new Set(['subtitle', 'search']);

export class ProblemPageParams {
  readonly value: string;

  constructor(
    currentSearchParams: URLSearchParams | ReadonlyURLSearchParams,
    overrides: Record<string, string | undefined> = {},
  ) {
    const qs = new URLSearchParams();

    for (const [key, val] of currentSearchParams.entries()) {
      if (!EXCLUDED_PARAMS.has(key)) qs.set(key, val);
    }

    for (const [key, val] of Object.entries(overrides)) {
      if (val === undefined) {
        qs.delete(key);
      } else {
        qs.set(key, val);
      }
    }

    const qsStr = qs.toString();
    this.value = qsStr ? `?${qsStr}` : '';
  }

  toString() {
    return this.value;
  }
}
