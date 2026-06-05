import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || 'localhost'),
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || 'postgres'),
  password: process.env.DATABASE_URL ? undefined : (process.env.DB_PASSWORD || 'password123'),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_DATABASE || 'ikonex_academy'),
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Helper for query execution
export const query = (text, params) => pool.query(text, params);

// Database initialization & seeding
export async function initDb() {
  console.log('Initializing database...');
  try {
    // 1. Read and execute database.sql
    const sqlPath = path.join(__dirname, '../database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // We can run the DDL schema to create tables. 
    // To avoid resetting every time, we check if class_streams table exists first.
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'class_streams'
      );
    `);
    
    const exists = tableCheck.rows[0].exists;
    if (!exists) {
      console.log('Tables do not exist. Executing schema...');
      await pool.query(sql);
      console.log('Schema created successfully.');
      
      // Seed default data
      await seedDefaults();
    } else {
      console.log('Database already initialized.');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

async function seedDefaults() {
  console.log('Seeding default data...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed class streams: Form 1-4 with colors Green, Yellow, Orange, Blue
    const colors = ['Green', 'Yellow', 'Orange', 'Blue'];
    const grades = [1, 2, 3, 4];
    
    for (const grade of grades) {
      for (const color of colors) {
        const name = `Form ${grade} ${color}`;
        await client.query(
          `INSERT INTO class_streams (name, grade, color) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
          [name, grade, color]
        );
      }
    }
    console.log('Seeded default class streams.');

    // 2. Seed default subjects
    const defaultSubjects = [
      { name: 'Mathematics', code: 'MATH' },
      { name: 'English Language', code: 'ENG' },
      { name: 'Chemistry', code: 'CHEM' },
      { name: 'Biology', code: 'BIO' },
      { name: 'Physics', code: 'PHYS' },
      { name: 'History', code: 'HIST' },
      { name: 'Geography', code: 'GEOG' },
    ];

    for (const sub of defaultSubjects) {
      await client.query(
        `INSERT INTO subjects (name, code) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [sub.name, sub.code]
      );
    }
    console.log('Seeded default subjects.');

    // Assign all default subjects to all default class streams
    const streamsRes = await client.query('SELECT id FROM class_streams');
    const subjectsRes = await client.query('SELECT id FROM subjects');
    
    for (const streamRow of streamsRes.rows) {
      for (const subRow of subjectsRes.rows) {
        await client.query(
          `INSERT INTO class_stream_subjects (class_stream_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [streamRow.id, subRow.id]
        );
      }
    }
    console.log('Assigned subjects to streams.');

    // 3. Seed default grading scales
    const defaultGrades = [
      { grade: 'A', min_score: 80.0, max_score: 100.0, remarks: 'Excellent' },
      { grade: 'B', min_score: 70.0, max_score: 79.99, remarks: 'Very Good' },
      { grade: 'C', min_score: 60.0, max_score: 69.99, remarks: 'Good' },
      { grade: 'D', min_score: 50.0, max_score: 59.99, remarks: 'Pass' },
      { grade: 'F', min_score: 0.0, max_score: 49.99, remarks: 'Fail' },
    ];

    for (const dg of defaultGrades) {
      await client.query(
        `INSERT INTO grading_scales (grade, min_score, max_score, remarks) VALUES ($1, $2, $3, $4) ON CONFLICT (grade) DO NOTHING`,
        [dg.grade, dg.min_score, dg.max_score, dg.remarks]
      );
    }
    console.log('Seeded default grading scales.');

    // 4. Seed system settings
    const defaultSettings = [
      { key: 'ca_max_score', value: '30' },
      { key: 'exam_max_score', value: '70' }
    ];

    for (const set of defaultSettings) {
      await client.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [set.key, set.value]
      );
    }
    console.log('Seeded default system settings.');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to seed defaults, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
