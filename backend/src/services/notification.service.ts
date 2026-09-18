import { FastifyReply } from 'fastify';

interface SSEClient {
  id: string;
  facilityId?: string;
  reply: FastifyReply;
}

export class NotificationService {
  private clients = new Map<string, SSEClient>();

  addClient(clientId: string, reply: FastifyReply, facilityId?: string) {
    this.clients.set(clientId, { id: clientId, reply, facilityId });
    console.log(`[SSE] Client connected: ${clientId} (Facility: ${facilityId || 'All'})`);

    // Send initial keepalive
    this.sendToClient(clientId, 'connection.established', {
      clientId,
      status: 'connected',
      timestamp: new Date().toISOString(),
    });
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId);
    console.log(`[SSE] Client disconnected: ${clientId}`);
  }

  broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.reply.raw.write(payload);
      } catch (err: any) {
        console.warn(`[SSE BROADCAST ERROR] Client ${id}:`, err.message);
        this.clients.delete(id);
      }
    }
  }

  sendToFacility(facilityId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (!client.facilityId || client.facilityId === facilityId) {
        try {
          client.reply.raw.write(payload);
        } catch (err: any) {
          this.clients.delete(id);
        }
      }
    }
  }

  sendToClient(clientId: string, event: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (err: any) {
        this.clients.delete(clientId);
      }
    }
  }
}

export const notificationService = new NotificationService();
