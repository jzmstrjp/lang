#!/usr/bin/env tsx

import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    const updated = await prisma.appConfig.update({
      where: { key: 'LATEST_USED_WORD' },
      data: { value: 'XXX' },
    });

    console.log(`更新完了: ${updated.key} = ${updated.value}`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
