import { buildApp } from './app.js';
import { config } from './config/index.js';

async function startServer() {
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });
    console.log('====================================================');
    console.log(`🚀 ReferralOS API Gateway running on ${address}`);
    console.log(`📡 Health endpoint: ${address}/health`);
    console.log(`🔗 API Base: ${address}/api/v1`);
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Failed to start ReferralOS server:', err.message);
    process.exit(1);
  }
}

startServer();
