#!/usr/bin/env tsx

import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    const configs = await prisma.appConfig.findMany({
      orderBy: { key: 'asc' },
    });

    if (configs.length === 0) {
      console.log('（AppConfig にデータがありません）');
      return;
    }

    const keyWidth = Math.max(...configs.map((c) => c.key.length), 'key'.length);
    const valWidth = Math.max(...configs.map((c) => c.value.length), 'value'.length);

    const header = `${'key'.padEnd(keyWidth)}  ${'value'.padEnd(valWidth)}  updatedAt`;
    const divider = '-'.repeat(header.length);

    console.log(header);
    console.log(divider);

    for (const config of configs) {
      const updatedAt = config.updatedAt.toISOString().replace('T', ' ').slice(0, 19);
      console.log(`${config.key.padEnd(keyWidth)}  ${config.value.padEnd(valWidth)}  ${updatedAt}`);
    }

    console.log(divider);
    console.log(`合計: ${configs.length} 件`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
