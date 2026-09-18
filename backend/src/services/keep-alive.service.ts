import { config } from '../config/index.js';

export class KeepAliveService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning || !config.selfPingEnabled) return;
    this.isRunning = true;

    const targetUrl = `${config.appUrl.replace(/\/$/, '')}/health`;
    const intervalMs = config.selfPingIntervalMs;

    console.log(`[KEEP-ALIVE] Initialized self-ping service targeting ${targetUrl} every ${intervalMs / 1000}s`);

    // Run first ping after a short 10s warmup delay
    setTimeout(() => {
      this.ping(targetUrl);
    }, 10000);

    this.timer = setInterval(() => {
      this.ping(targetUrl);
    }, intervalMs);

    // Ensure timer doesn't keep node process from exiting in test runners
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  private async ping(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'ReferralOS-KeepAlive/1.0' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        console.log(`[KEEP-ALIVE] Health ping to ${url} succeeded (status: ${response.status})`);
      } else {
        console.warn(`[KEEP-ALIVE] Health ping to ${url} returned status: ${response.status}`);
      }
    } catch (err: any) {
      // If external ping fails (e.g. cold DNS or offline local test), try loopback
      try {
        const loopbackUrl = `http://127.0.0.1:${config.port}/health`;
        const loopbackRes = await fetch(loopbackUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (loopbackRes.ok) {
          console.log(`[KEEP-ALIVE] Loopback health ping to ${loopbackUrl} succeeded (status: ${loopbackRes.status})`);
          return;
        }
      } catch {}
      console.warn(`[KEEP-ALIVE] Self-ping failed: ${err.message}`);
    }
  }
}

export const keepAliveService = new KeepAliveService();
