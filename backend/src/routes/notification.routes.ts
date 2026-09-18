import { FastifyInstance } from 'fastify';
import { notificationService } from '../services/notification.service.js';
import { randomUUID } from 'node:crypto';

export async function notificationRoutes(fastify: FastifyInstance) {
  // GET /api/v1/notifications/stream (Server-Sent Events)
  fastify.get('/notifications/stream', async (request, reply) => {
    const query = request.query as any;
    const clientId = `client_${randomUUID().substring(0, 8)}`;
    const facilityId = query?.facility_id;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    notificationService.addClient(clientId, reply, facilityId);

    request.raw.on('close', () => {
      notificationService.removeClient(clientId);
    });

    // Keep connection alive indefinitely until client closes
    await new Promise(() => {});
  });
}
