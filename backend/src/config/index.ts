import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

export interface AppConfig {
  env: string;
  isProduction: boolean;
  port: number;
  host: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  apiBaseUrl: string;
}

const dbUrl = process.env.DATABASE_URL || process.env.DB_URL;
if (!dbUrl) {
  console.warn('[CONFIG WARNING] Neither DATABASE_URL nor DB_URL is set in environment.');
}

let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
if (redisUrl.includes('-u ')) {
  const match = redisUrl.match(/-u\s+([^\s]+)/);
  if (match) redisUrl = match[1];
}
// Upstash TLS requires rediss:// protocol
if (redisUrl.includes('upstash.io') && redisUrl.startsWith('redis://')) {
  redisUrl = redisUrl.replace('redis://', 'rediss://');
}

export const config: AppConfig = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: dbUrl || 'postgresql://localhost:5432/referralos',
  redisUrl: redisUrl || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-fallback-secret-min-32-chars-referralos',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim()),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8080/api/v1',
};
