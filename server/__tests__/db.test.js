import test from 'node:test';
import assert from 'node:assert';
import pool, { query, initDb } from '../db.js';

test('database integration - initialization and seed verification', async () => {
  try {
    // 1. Run tables initialization and seed defaults
    await initDb();

    // 2. Query class streams
    const streamsRes = await query('SELECT * FROM class_streams ORDER BY name');
    
    // Check that we have exactly 16 streams seeded
    assert.strictEqual(streamsRes.rows.length, 16);
    
    const streamNames = streamsRes.rows.map(s => s.name);
    assert.ok(streamNames.includes('Form 1 Green'));
    assert.ok(streamNames.includes('Form 4 Blue'));
    assert.ok(streamNames.includes('Form 2 Yellow'));
    assert.ok(streamNames.includes('Form 3 Orange'));

    // 3. Query subjects
    const subjectsRes = await query('SELECT * FROM subjects ORDER BY name');
    assert.ok(subjectsRes.rows.length >= 7); // Default seeded subjects count is 7

    // 4. Query grading scales
    const gradingRes = await query('SELECT * FROM grading_scales ORDER BY min_score DESC');
    assert.strictEqual(gradingRes.rows.length, 5); // A, B, C, D, F
    
    const gradeA = gradingRes.rows.find(g => g.grade === 'A');
    assert.strictEqual(parseFloat(gradeA.min_score), 80.0);
    assert.strictEqual(parseFloat(gradeA.max_score), 100.0);

    console.log('Database integration tests passed successfully.');
  } finally {
    // End the pool so the test process exits cleanly
    await pool.end();
  }
});
