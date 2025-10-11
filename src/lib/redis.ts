import { Redis } from '@upstash/redis';

const globalForRedis = globalThis as unknown as {
  redisClient?: Redis;
};

function createRedisClient(): Redis | null {
  try {
    return Redis.fromEnv();
  } catch (error) {
    console.warn('[Redis] 環境変数が設定されていないためRedisキャッシュを無効化します。', error);
    return null;
  }
}

export const redisClient = globalForRedis.redisClient ?? createRedisClient();

if (!globalForRedis.redisClient && redisClient) {
  globalForRedis.redisClient = redisClient;
}
