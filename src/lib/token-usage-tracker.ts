export type TokenUsageEntry = {
  phase: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

const entries: TokenUsageEntry[] = [];

export function recordTokenUsage(
  phase: string,
  usage:
    | {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
      }
    | undefined,
): void {
  if (!usage) return;
  entries.push({
    phase,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cachedTokens: usage.input_tokens_details?.cached_tokens ?? 0,
  });
}

export function getTokenUsageEntries(): readonly TokenUsageEntry[] {
  return entries;
}

export function printTokenUsageSummary(): void {
  if (entries.length === 0) {
    console.error('\n📊 トークン使用履歴なし');
    return;
  }

  const colPhase = 38;
  const colNum = 10;

  const header = [
    'フェーズ'.padEnd(colPhase),
    'Input'.padStart(colNum),
    'Output'.padStart(colNum),
    'Cached'.padStart(colNum),
    'Total'.padStart(colNum),
  ].join('  ');
  const separator = '─'.repeat(header.length);

  console.error(`\n${'═'.repeat(separator.length)}`);
  console.error('📊 トークン使用量サマリー');
  console.error(separator);
  console.error(header);
  console.error(separator);

  // フェーズ別に集計
  const byPhase = new Map<
    string,
    { input: number; output: number; cached: number; count: number }
  >();
  for (const e of entries) {
    const cur = byPhase.get(e.phase) ?? { input: 0, output: 0, cached: 0, count: 0 };
    byPhase.set(e.phase, {
      input: cur.input + e.inputTokens,
      output: cur.output + e.outputTokens,
      cached: cur.cached + e.cachedTokens,
      count: cur.count + 1,
    });
  }

  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;

  for (const [phase, s] of byPhase) {
    const total = s.input + s.output;
    const label = s.count > 1 ? `${phase} (×${s.count})` : phase;
    console.error(
      [
        label.padEnd(colPhase),
        s.input.toLocaleString().padStart(colNum),
        s.output.toLocaleString().padStart(colNum),
        s.cached.toLocaleString().padStart(colNum),
        total.toLocaleString().padStart(colNum),
      ].join('  '),
    );
    totalInput += s.input;
    totalOutput += s.output;
    totalCached += s.cached;
  }

  const grandTotal = totalInput + totalOutput;
  console.error(separator);
  console.error(
    [
      '合計'.padEnd(colPhase),
      totalInput.toLocaleString().padStart(colNum),
      totalOutput.toLocaleString().padStart(colNum),
      totalCached.toLocaleString().padStart(colNum),
      grandTotal.toLocaleString().padStart(colNum),
    ].join('  '),
  );

  if (totalInput > 0) {
    const cacheRate = ((totalCached / totalInput) * 100).toFixed(1);
    console.error(
      `   キャッシュヒット率: ${cacheRate}%（Input ${totalCached.toLocaleString()} tokens がキャッシュから）`,
    );
  }

  console.error('═'.repeat(separator.length));
}
