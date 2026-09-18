import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/index.js';
import { checkDatabaseConnection } from './infrastructure/database.js';
import { checkRedisConnection, closeRedisClients } from './infrastructure/redis.js';
import { failoverWatcherService } from './services/failover-watcher.service.js';
import { keepAliveService } from './services/keep-alive.service.js';

// Route modules
import { facilityRoutes } from './routes/facility.routes.js';
import { referralRoutes } from './routes/referral.routes.js';
import { reservationRoutes } from './routes/reservation.routes.js';
import { transportRoutes } from './routes/transport.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    pluginTimeout: 30000,
    logger: {
      level: config.isProduction ? 'info' : 'warn',
    },
  });

  // CORS Configuration
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Root & Health Checks
  app.get('/', async () => ({
    name: 'ReferralOS Core Engine API',
    version: '1.0.0',
    documentation: '/docs',
    status: 'OPERATIONAL',
  }));

  app.get('/health', async (request, reply) => {
    const dbHealth = await checkDatabaseConnection();
    const redisOk = await checkRedisConnection();

    const isHealthy = dbHealth.ok;
    return reply.code(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'HEALTHY' : 'DEGRADED',
      database: dbHealth,
      redis: { ok: redisOk },
      timestamp: new Date().toISOString(),
    });
  });

  // Register API Routes under /api/v1 prefix
  await app.register(
    async (v1) => {
      v1.get('/health', async () => ({ status: 'UP', timestamp: new Date().toISOString() }));
      await v1.register(facilityRoutes);
      await v1.register(referralRoutes);
      await v1.register(reservationRoutes);
      await v1.register(transportRoutes);
      await v1.register(notificationRoutes);
    },
    { prefix: '/api/v1' }
  );

  // Initialize background services (Failover Watcher & Keep-Alive Self-Ping)
  app.addHook('onReady', async () => {
    failoverWatcherService.start().catch((err) => {
      console.warn('[FAILOVER WATCHER START WARNING]', err.message);
    });
    keepAliveService.start();
  });

  // Clean shutdown
  app.addHook('onClose', async () => {
    keepAliveService.stop();
    await failoverWatcherService.stop();
    await closeRedisClients();
  });

  return app;
}
