import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/index.js';

const isSslNeeded =
  config.databaseUrl.includes('sslmode=require') ||
  config.databaseUrl.includes('neon.tech') ||
  config.isProduction;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isSslNeeded ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err: Error) => {
  console.error('[DATABASE POOL ERROR] Unexpected client error:', err.message);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[SLOW QUERY] ${duration}ms: ${text}`);
    }
    return res;
  } catch (err: any) {
    console.error(`[QUERY ERROR] Execution failed: ${err.message}\nQuery: ${text}`);
    throw err;
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabaseConnection(): Promise<{ ok: boolean; postgis: boolean; version?: string }> {
  try {
    const res = await query<{ version: string }>('SELECT version()');
    const postgisRes = await query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname = 'postgis'"
    );
    const hasPostgis = postgisRes.rows.length > 0;
    return { ok: true, postgis: hasPostgis, version: res.rows[0]?.version };
  } catch (err: any) {
    console.error('[DATABASE CONNECTION FAILED]', err.message);
    return { ok: false, postgis: false };
  }
}
