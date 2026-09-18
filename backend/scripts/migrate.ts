import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, checkDatabaseConnection } from '../src/infrastructure/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('----------------------------------------------------');
  console.log('🔄 ReferralOS: Running Database Migrations...');
  console.log('----------------------------------------------------');

  const health = await checkDatabaseConnection();
  if (!health.ok) {
    console.error('❌ Could not connect to PostgreSQL. Please verify your DATABASE_URL in .env');
    process.exit(1);
  }

  console.log(`✅ Connected to PostgreSQL. PostGIS active: ${health.postgis ? 'YES' : 'Will activate now'}`);

  const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('✅ 001_initial_schema.sql executed successfully.');

    const tablesRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📊 Active database tables:');
    tablesRes.rows.forEach((row) => console.log(`   - ${row.table_name}`));

    console.log('----------------------------------------------------');
    console.log('🎉 All migrations completed successfully!');
    console.log('----------------------------------------------------');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
