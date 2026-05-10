#!/usr/bin/env tsx

import { prisma } from '../src/lib/prisma';

const RESET_VALUE = 'XXX';

async function main() {
  try {
    for (const key of ['LATEST_USED_WORD', 'LATEST_USED_WORD_KIDS']) {
      const updated = await prisma.appConfig.update({
        where: { key },
        data: { value: RESET_VALUE },
      });
      console.log(`更新完了: ${updated.key} = ${updated.value}`);
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
