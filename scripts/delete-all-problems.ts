#!/usr/bin/env tsx

/**
 * problemsテーブルの全レコードを削除するスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/delete-all-problems.ts
 *
 * dry-run（削除せず件数確認のみ）:
 *   DRY_RUN=true npx tsx scripts/delete-all-problems.ts
 */

import { prisma } from '../src/lib/prisma';

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const count = await prisma.problem.count();
  console.log(`[DB] problems テーブルの件数: ${count}`);

  if (count === 0) {
    console.log('[DB] 削除対象なし。終了します。');
    return;
  }

  if (DRY_RUN) {
    console.log('[DB] *** DRY RUN モード（実際には削除しません）***');
    return;
  }

  const { count: deleted } = await prisma.problem.deleteMany();
  console.log(`[DB] 削除完了: ${deleted} 件`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
