import { Redis } from 'ioredis';
import { config } from '../config/index.js';

let redisInstance: Redis | null = null;
let pubInstance: Redis | null = null;
let subInstance: Redis | null = null;

function createRedisClient(role: string): Redis {
  const isTls = config.redisUrl.startsWith('rediss://');
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 20000,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 3000);
      return delay;
    },
    lazyConnect: true,
    enableAutoPipelining: true,
  });

  client.on('connect', () => {
    console.log(`[REDIS] ${role} connected successfully.`);
  });

  client.on('error', (err) => {
    console.error(`[REDIS ERROR] ${role} error:`, err.message);
  });

  return client;
}

export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = createRedisClient('Main Client');
  }
  return redisInstance;
}

export function getPubClient(): Redis {
  if (!pubInstance) {
    pubInstance = createRedisClient('Publisher');
  }
  return pubInstance;
}

export function getSubClient(): Redis {
  if (!subInstance) {
    subInstance = createRedisClient('Subscriber');
  }
  return subInstance;
}

export async function closeRedisClients(): Promise<void> {
  try {
    if (subInstance) {
      await subInstance.quit().catch(() => {});
      subInstance = null;
    }
    if (pubInstance) {
      await pubInstance.quit().catch(() => {});
      pubInstance = null;
    }
    if (redisInstance) {
      await redisInstance.quit().catch(() => {});
      redisInstance = null;
    }
  } catch {}
}

// In-memory fallback if Redis is temporarily unreachable in development
const memoryLocks = new Map<string, { value: string; expiresAt: number }>();
const memorySubscribers = new Map<string, Set<(message: string) => void>>();

export class RedisLockManager {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Atomically acquire locks on multiple resources using a Lua script.
   * If ANY resource in resourceIds is already locked, none are acquired.
   * Returns true on success, false if conflict occurs.
   */
  async acquireMultiLock(
    resourceIds: string[],
    reservationId: string,
    ttlSeconds: number
  ): Promise<boolean> {
    const keys = resourceIds.map((id) => `lock:resource:${id}`);
    const ttlMs = ttlSeconds * 1000;

    // Lua script: verifies none of the keys exist, then sets all keys atomically
    const luaScript = `
      for i, key in ipairs(KEYS) do
        if redis.call('EXISTS', key) == 1 then
          return 0
        end
      end
      for i, key in ipairs(KEYS) do
        redis.call('SET', key, ARGV[1], 'PX', ARGV[2])
      end
      return 1
    `;

    try {
      if (this.redis.status === 'ready' || this.redis.status === 'connecting') {
        const result = await this.redis.eval(
          luaScript,
          keys.length,
          ...keys,
          reservationId,
          ttlMs.toString()
        );
        return result === 1;
      }
    } catch (err: any) {
      console.warn('[REDIS LOCK] Redis unavailable, using in-memory lock fallback:', err.message);
    }

    // In-memory atomic fallback
    const now = Date.now();
    for (const key of keys) {
      const existing = memoryLocks.get(key);
      if (existing && existing.expiresAt > now) {
        return false; // Conflict
      }
    }

    // Acquire all
    for (const key of keys) {
      memoryLocks.set(key, { value: reservationId, expiresAt: now + ttlMs });
    }
    return true;
  }

  /**
   * Release locks for given resources if they match the reservationId.
   */
  async releaseMultiLock(resourceIds: string[], reservationId: string): Promise<void> {
    const keys = resourceIds.map((id) => `lock:resource:${id}`);

    const luaScript = `
      for i, key in ipairs(KEYS) do
        if redis.call('GET', key) == ARGV[1] then
          redis.call('DEL', key)
        end
      end
      return 1
    `;

    try {
      if (this.redis.status === 'ready') {
        await this.redis.eval(luaScript, keys.length, ...keys, reservationId);
        return;
      }
    } catch (err: any) {
      console.warn('[REDIS UNLOCK] Redis error, cleaning in-memory locks:', err.message);
    }

    // In-memory fallback
    for (const key of keys) {
      const existing = memoryLocks.get(key);
      if (existing && existing.value === reservationId) {
        memoryLocks.delete(key);
      }
    }
  }

  /**
   * Extend TTL on a reservation
   */
  async extendMultiLock(
    resourceIds: string[],
    reservationId: string,
    additionalSeconds: number
  ): Promise<boolean> {
    const keys = resourceIds.map((id) => `lock:resource:${id}`);
    const ttlMs = additionalSeconds * 1000;

    const luaScript = `
      for i, key in ipairs(KEYS) do
        if redis.call('GET', key) ~= ARGV[1] then
          return 0
        end
      end
      for i, key in ipairs(KEYS) do
        local currentPttl = redis.call('PTTL', key)
        if currentPttl > 0 then
          redis.call('PEXPIRE', key, currentPttl + ARGV[2])
        else
          redis.call('PEXPIRE', key, ARGV[2])
        end
      end
      return 1
    `;

    try {
      if (this.redis.status === 'ready') {
        const result = await this.redis.eval(
          luaScript,
          keys.length,
          ...keys,
          reservationId,
          ttlMs.toString()
        );
        return result === 1;
      }
    } catch (err: any) {
      console.warn('[REDIS EXTEND] Redis error:', err.message);
    }

    // In-memory
    const now = Date.now();
    for (const key of keys) {
      const existing = memoryLocks.get(key);
      if (!existing || existing.value !== reservationId || existing.expiresAt <= now) {
        return false;
      }
    }
    for (const key of keys) {
      const existing = memoryLocks.get(key)!;
      existing.expiresAt += ttlMs;
    }
    return true;
  }
}
