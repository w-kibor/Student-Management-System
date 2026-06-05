import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, initDb } from './server/db.js';
import { processResults, processSubjectRanks } from './server/resultsProcessor.js';
import { generateStudentReportCard, generateClassPerformanceReport } from './server/pdfGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// CORE SYSTEM HELPERS
// ==========================================

// Get system thresholds (CA and Exam max limits)
async function getSystemLimits() {
  const res = await query('SELECT key, value FROM system_settings');
  const limits = {};
  res.rows.forEach(row => {
    limits[row.key] = parseFloat(row.value);
  });
  return {
    ca_max: limits.ca_max_score || 30,
    exam_max: limits.exam_max_score || 70
  };
}

// ==========================================
// CLASS STREAM ENDPOINTS
// ==========================================

// List all streams with student counts
app.get('/api/streams', async (req, res) => {
  try {
    const result = await query(`
      SELECT cs.id, cs.name, cs.grade, cs.color, COUNT(s.id)::int as student_count
      FROM class_streams cs
      LEFT JOIN students s ON s.class_stream_id = cs.id
      GROUP BY cs.id, cs.name, cs.grade, cs.color
      ORDER BY cs.grade ASC, cs.color ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching streams' });
  }
});

// View a single stream with its assigned subjects and students
app.get('/api/streams/:id', async (req, res) => {
  try {
    const streamId = parseInt(req.params.id, 10);
    
    // Fetch stream metadata
    const streamRes = await query('SELECT * FROM class_streams WHERE id = $1', [streamId]);
    if (streamRes.rows.length === 0) {
      return res.status(404).json({ error: 'Class stream not found' });
    }
    const stream = streamRes.rows[0];

    // Fetch assigned subjects
    const subjectsRes = await query(`
      SELECT s.* FROM subjects s
      JOIN class_stream_subjects css ON css.subject_id = s.id
      WHERE css.class_stream_id = $1
      ORDER BY s.name
    `, [streamId]);

    // Fetch students in this stream
    const studentsRes = await query(`
      SELECT id, name, admission_number, email, date_of_birth 
      FROM students 
      WHERE class_stream_id = $1 
      ORDER BY name
    `, [streamId]);

    res.json({
      ...stream,
      subjects: subjectsRes.rows,
      students: studentsRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching stream details' });
  }
});

// Create a new stream
app.post('/api/streams', async (req, res) => {
  const { name, grade, color } = req.body;
  if (!name || !grade || !color) {
    return res.status(400).json({ error: 'Name, grade (1-4), and color (Green, Yellow, Orange, Blue) are required' });
  }
  
  const formattedGrade = parseInt(grade, 10);
  if (formattedGrade < 1 || formattedGrade > 4) {
    return res.status(400).json({ error: 'Grade must be between 1 and 4' });
  }

  if (typeof color !== 'string' || color.trim() === '') {
    return res.status(400).json({ error: 'Color is required and must be a string' });
  }

  try {
    const result = await query(
      'INSERT INTO class_streams (name, grade, color) VALUES ($1, $2, $3) RETURNING *',
      [name, formattedGrade, color]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') { // unique violation
      return res.status(400).json({ error: 'A stream with this name already exists' });
    }
    res.status(500).json({ error: 'Database error creating stream' });
  }
});

// Assign subjects to a class stream
app.post('/api/streams/:id/subjects', async (req, res) => {
  const streamId = parseInt(req.params.id, 10);
  const { subject_ids } = req.body; // Array of subject IDs
  
  if (!Array.isArray(subject_ids)) {
    return res.status(400).json({ error: 'subject_ids must be an array' });
  }

  try {
    await query('BEGIN');
    
    // Clear old assignments
    await query('DELETE FROM class_stream_subjects WHERE class_stream_id = $1', [streamId]);

    // Insert new assignments
    for (const subId of subject_ids) {
      await query(
        'INSERT INTO class_stream_subjects (class_stream_id, subject_id) VALUES ($1, $2)',
        [streamId, subId]
      );
    }

    await query('COMMIT');
    res.json({ message: 'Subjects successfully assigned to stream' });
  } catch (err) {
    await query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to assign subjects' });
  }
});


// ==========================================
// STUDENT ENDPOINTS
// ==========================================

// List all students (with stream name)
app.get('/api/students', async (req, res) => {
  try {
    const { stream_id } = req.query;
    let result;
    if (stream_id) {
      result = await query(`
        SELECT s.*, cs.name as stream_name, cs.color as stream_color
        FROM students s
        JOIN class_streams cs ON s.class_stream_id = cs.id
        WHERE s.class_stream_id = $1
        ORDER BY s.name
      `, [parseInt(stream_id, 10)]);
    } else {
      result = await query(`
        SELECT s.*, cs.name as stream_name, cs.color as stream_color
        FROM students s
        JOIN class_streams cs ON s.class_stream_id = cs.id
        ORDER BY s.name
      `);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching students' });
  }
});

// View a single student (with current scores)
app.get('/api/students/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const studentRes = await query(`
      SELECT s.*, cs.name as stream_name, cs.color as stream_color
      FROM students s
      JOIN class_streams cs ON s.class_stream_id = cs.id
      WHERE s.id = $1
    `, [studentId]);

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentRes.rows[0];

    // Fetch scores with subject details
    const scoresRes = await query(`
      SELECT sc.id, sc.subject_id, sub.name as subject_name, sub.code as subject_code,
             sc.continuous_assessment, sc.exam, sc.total_score
      FROM scores sc
      JOIN subjects sub ON sc.subject_id = sub.id
      WHERE sc.student_id = $1
      ORDER BY sub.name
    `, [studentId]);

    res.json({
      ...student,
      scores: scoresRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching student' });
  }
});

// Register student
app.post('/api/students', async (req, res) => {
  const { name, admission_number, class_stream_id, email, date_of_birth } = req.body;
  if (!name || !admission_number || !class_stream_id) {
    return res.status(400).json({ error: 'Name, admission number, and class stream are required' });
  }

  try {
    const result = await query(`
      INSERT INTO students (name, admission_number, class_stream_id, email, date_of_birth)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, admission_number, parseInt(class_stream_id, 10), email || null, date_of_birth || null]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Admission number already registered' });
    }
    res.status(500).json({ error: 'Database error registering student' });
  }
});

// Edit student details
app.put('/api/students/:id', async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  const { name, admission_number, class_stream_id, email, date_of_birth } = req.body;
  
  if (!name || !admission_number || !class_stream_id) {
    return res.status(400).json({ error: 'Name, admission number, and class stream are required' });
  }

  try {
    const result = await query(`
      UPDATE students 
      SET name = $1, admission_number = $2, class_stream_id = $3, email = $4, date_of_birth = $5
      WHERE id = $6
      RETURNING *
    `, [name, admission_number, parseInt(class_stream_id, 10), email || null, date_of_birth || null, studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Admission number already exists on another student' });
    }
    res.status(500).json({ error: 'Database error updating student' });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  try {
    const result = await query('DELETE FROM students WHERE id = $1 RETURNING *', [studentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student successfully deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting student' });
  }
});


// ==========================================
// SUBJECT ENDPOINTS
// ==========================================

// Get all subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const result = await query('SELECT * FROM subjects ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching subjects' });
  }
});

// Create subject
app.post('/api/subjects', async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Subject name and code are required' });
  }

  try {
    const result = await query(
      'INSERT INTO subjects (name, code) VALUES ($1, $2) RETURNING *',
      [name, code.toUpperCase()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Subject name or code already exists' });
    }
    res.status(500).json({ error: 'Database error creating subject' });
  }
});

// Edit subject
app.put('/api/subjects/:id', async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);
  const { name, code } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Subject name and code are required' });
  }

  try {
    const result = await query(
      'UPDATE subjects SET name = $1, code = $2 WHERE id = $3 RETURNING *',
      [name, code.toUpperCase(), subjectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Subject name or code already exists on another subject' });
    }
    res.status(500).json({ error: 'Database error updating subject' });
  }
});

// Delete subject
app.delete('/api/subjects/:id', async (req, res) => {
  const subjectId = parseInt(req.params.id, 10);
  try {
    const result = await query('DELETE FROM subjects WHERE id = $1 RETURNING *', [subjectId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json({ message: 'Subject successfully deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting subject' });
  }
});


// ==========================================
// SCORING ENDPOINTS
// ==========================================

// Get scores for all students in a stream for a selected subject
app.get('/api/scores/stream/:streamId/subject/:subjectId', async (req, res) => {
  try {
    const streamId = parseInt(req.params.streamId, 10);
    const subjectId = parseInt(req.params.subjectId, 10);

    // Verify stream offers this subject
    const relationCheck = await query(`
      SELECT 1 FROM class_stream_subjects 
      WHERE class_stream_id = $1 AND subject_id = $2
    `, [streamId, subjectId]);

    if (relationCheck.rows.length === 0) {
      return res.status(400).json({ error: 'This subject is not assigned to this class stream' });
    }

    // Fetch scores
    const result = await query(`
      SELECT st.id as student_id, st.name as student_name, st.admission_number,
             sc.id as score_id, COALESCE(sc.continuous_assessment, 0.00)::float as continuous_assessment,
             COALESCE(sc.exam, 0.00)::float as exam, COALESCE(sc.total_score, 0.00)::float as total_score
      FROM students st
      LEFT JOIN scores sc ON sc.student_id = st.id AND sc.subject_id = $2
      WHERE st.class_stream_id = $1
      ORDER BY st.name
    `, [streamId, subjectId]);

    const limits = await getSystemLimits();

    res.json({
      limits,
      scores: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching scores sheet' });
  }
});

// Bulk upsert/record scores for a stream & subject
app.post('/api/scores/bulk', async (req, res) => {
  const { stream_id, subject_id, scores } = req.body;
  if (!stream_id || !subject_id || !Array.isArray(scores)) {
    return res.status(400).json({ error: 'Stream ID, Subject ID, and scores array are required' });
  }

  const limits = await getSystemLimits();

  // Validate all scores before writing to prevent partial transaction updates
  for (const scoreEntry of scores) {
    const ca = parseFloat(scoreEntry.continuous_assessment || 0);
    const exam = parseFloat(scoreEntry.exam || 0);

    if (ca < 0 || ca > limits.ca_max || exam < 0 || exam > limits.exam_max) {
      return res.status(400).json({
        error: `Validation failed. Scores must be non-negative. Max CA is ${limits.ca_max}, max Exam is ${limits.exam_max}.`
      });
    }
  }

  try {
    await query('BEGIN');
    
    for (const entry of scores) {
      const studentId = parseInt(entry.student_id, 10);
      const ca = parseFloat(entry.continuous_assessment || 0);
      const exam = parseFloat(entry.exam || 0);

      await query(`
        INSERT INTO scores (student_id, subject_id, continuous_assessment, exam)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (student_id, subject_id)
        DO UPDATE SET 
          continuous_assessment = EXCLUDED.continuous_assessment,
          exam = EXCLUDED.exam
      `, [studentId, parseInt(subject_id, 10), ca, exam]);
    }

    await query('COMMIT');
    res.json({ message: 'Scores saved successfully!' });
  } catch (err) {
    await query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database transaction failed saving scores' });
  }
});


// ==========================================
// SETTINGS ENDPOINTS
// ==========================================

// Get current grading brackets
app.get('/api/settings/grades', async (req, res) => {
  try {
    const result = await query('SELECT * FROM grading_scales ORDER BY min_score DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching grades configuration' });
  }
});

// Update grading scale configurations
app.put('/api/settings/grades', async (req, res) => {
  const { scales } = req.body; // Array of { grade, min_score, max_score, remarks }
  
  if (!Array.isArray(scales) || scales.length === 0) {
    return res.status(400).json({ error: 'Scales must be a non-empty array' });
  }

  try {
    await query('BEGIN');
    
    // Clear old scales
    await query('DELETE FROM grading_scales');

    // Insert new scales
    for (const sc of scales) {
      await query(`
        INSERT INTO grading_scales (grade, min_score, max_score, remarks)
        VALUES ($1, $2, $3, $4)
      `, [sc.grade.toUpperCase(), parseFloat(sc.min_score), parseFloat(sc.max_score), sc.remarks || '']);
    }

    await query('COMMIT');
    res.json({ message: 'Grading scale configuration updated successfully' });
  } catch (err) {
    await query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database error updating grading scale configuration' });
  }
});

// Get system configurations (CA and Exam max limits)
app.get('/api/settings/configs', async (req, res) => {
  try {
    const limits = await getSystemLimits();
    res.json(limits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching settings' });
  }
});

// Update system configurations
app.put('/api/settings/configs', async (req, res) => {
  const { ca_max, exam_max } = req.body;
  if (ca_max === undefined || exam_max === undefined) {
    return res.status(400).json({ error: 'ca_max and exam_max values are required' });
  }

  try {
    await query('BEGIN');
    
    await query(`
      INSERT INTO system_settings (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, ['ca_max_score', ca_max.toString()]);

    await query(`
      INSERT INTO system_settings (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, ['exam_max_score', exam_max.toString()]);

    await query('COMMIT');
    res.json({ message: 'System configurations updated successfully' });
  } catch (err) {
    await query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database error updating system configurations' });
  }
});


// ==========================================
// RESULTS PROCESSING & REPORTS
// ==========================================

// Get a list of ranked students in a stream (includes statistics and average score)
app.get('/api/reports/stream/:streamId/rankings', async (req, res) => {
  try {
    const streamId = parseInt(req.params.streamId, 10);
    
    // 1. Fetch stream details
    const streamRes = await query('SELECT * FROM class_streams WHERE id = $1', [streamId]);
    if (streamRes.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // 2. Fetch all students in the stream
    const studentsRes = await query('SELECT id, name, admission_number FROM students WHERE class_stream_id = $1', [streamId]);
    const students = studentsRes.rows;

    if (students.length === 0) {
      return res.json({
        stream: streamRes.rows[0],
        students: [],
        subjectAverages: []
      });
    }

    // 3. Fetch all scores for students in this stream
    const studentIds = students.map(s => s.id);
    const scoresRes = await query(`
      SELECT sc.student_id, sc.subject_id, sub.code as subject_code, sub.name as subject_name,
             sc.continuous_assessment::float, sc.exam::float, sc.total_score::float
      FROM scores sc
      JOIN subjects sub ON sc.subject_id = sub.id
      WHERE sc.student_id = ANY($1)
    `, [studentIds]);
    const scores = scoresRes.rows;

    // 4. Fetch grading scales
    const scalesRes = await query('SELECT * FROM grading_scales ORDER BY min_score DESC');
    const gradingScales = scalesRes.rows;

    // 5. Run Results Processor
    const rankedStudents = processResults(students, scores, gradingScales);

    // 6. Calculate Subject Averages in this stream
    const subjectAveragesRes = await query(`
      SELECT sub.id, sub.name, sub.code, AVG(sc.total_score)::float as average_score
      FROM scores sc
      JOIN students s ON s.id = sc.student_id
      JOIN subjects sub ON sub.id = sc.subject_id
      WHERE s.class_stream_id = $1
      GROUP BY sub.id, sub.name, sub.code
      ORDER BY sub.name
    `, [streamId]);

    res.json({
      stream: streamRes.rows[0],
      students: rankedStudents,
      subjectAverages: subjectAveragesRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error calculating rankings' });
  }
});

// Download student PDF report card
app.get('/api/reports/student/:studentId/pdf', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    // 1. Fetch student info
    const studentRes = await query(`
      SELECT s.*, cs.name as stream_name, cs.color as stream_color
      FROM students s
      JOIN class_streams cs ON s.class_stream_id = cs.id
      WHERE s.id = $1
    `, [studentId]);

    if (studentRes.rows.length === 0) {
      return res.status(404).send('Student not found');
    }
    const student = studentRes.rows[0];
    const streamId = student.class_stream_id;

    // 2. Fetch all students in the stream
    const classmatesRes = await query('SELECT id, name, admission_number FROM students WHERE class_stream_id = $1', [streamId]);
    const classmates = classmatesRes.rows;

    // 3. Fetch all scores in the stream to calculate class ranks
    const classmateIds = classmates.map(s => s.id);
    const scoresRes = await query(`
      SELECT sc.student_id, sc.subject_id, sub.code as subject_code, sub.name as subject_name,
             sc.continuous_assessment::float, sc.exam::float, sc.total_score::float
      FROM scores sc
      JOIN subjects sub ON sc.subject_id = sub.id
      WHERE sc.student_id = ANY($1)
    `, [classmateIds]);
    const allScores = scoresRes.rows;

    // 4. Fetch grading scales
    const scalesRes = await query('SELECT * FROM grading_scales ORDER BY min_score DESC');
    const gradingScales = scalesRes.rows;

    // 5. Run results processing to resolve ranks
    const rankedStudents = processResults(classmates, allScores, gradingScales);
    const processedStudent = rankedStudents.find(s => s.id === studentId);

    // 6. Resolve Subject Position
    // Group all scores by subject
    const scoresBySubject = {};
    allScores.forEach(s => {
      if (!scoresBySubject[s.subject_id]) {
        scoresBySubject[s.subject_id] = [];
      }
      scoresBySubject[s.subject_id].push(s);
    });

    const studentScoresWithRanks = [];
    processedStudent.scores.forEach(s => {
      const subjectScores = scoresBySubject[s.subject_id] || [];
      const rankedSubjectScores = processSubjectRanks(subjectScores, gradingScales);
      const studentSubScore = rankedSubjectScores.find(rss => rss.student_id === studentId);
      
      studentScoresWithRanks.push({
        ...s,
        subject_position: studentSubScore ? studentSubScore.subject_position : null
      });
    });

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report_card_${student.admission_number}.pdf`);
    
    generateStudentReportCard(res, processedStudent, studentScoresWithRanks, classmates.length, gradingScales);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating PDF Report Card');
  }
});

// Download stream performance report PDF
app.get('/api/reports/stream/:streamId/pdf', async (req, res) => {
  try {
    const streamId = parseInt(req.params.streamId, 10);
    
    // 1. Fetch stream details
    const streamRes = await query('SELECT * FROM class_streams WHERE id = $1', [streamId]);
    if (streamRes.rows.length === 0) {
      return res.status(404).send('Stream not found');
    }
    const stream = streamRes.rows[0];

    // 2. Fetch students
    const studentsRes = await query('SELECT id, name, admission_number FROM students WHERE class_stream_id = $1', [streamId]);
    const students = studentsRes.rows;

    if (students.length === 0) {
      return res.status(400).send('No students in this class stream to report.');
    }

    const studentIds = students.map(s => s.id);
    const scoresRes = await query(`
      SELECT sc.student_id, sc.subject_id, sub.code as subject_code, sub.name as subject_name,
             sc.continuous_assessment::float, sc.exam::float, sc.total_score::float
      FROM scores sc
      JOIN subjects sub ON sc.subject_id = sub.id
      WHERE sc.student_id = ANY($1)
    `, [studentIds]);
    const allScores = scoresRes.rows;

    const scalesRes = await query('SELECT * FROM grading_scales ORDER BY min_score DESC');
    const gradingScales = scalesRes.rows;

    // Run Results Processor
    const rankedStudents = processResults(students, allScores, gradingScales);

    // Calculate Subject Averages in this stream
    const subjectAveragesRes = await query(`
      SELECT sub.id, sub.name, sub.code, AVG(sc.total_score)::float as average_score
      FROM scores sc
      JOIN students s ON s.id = sc.student_id
      JOIN subjects sub ON sub.id = sc.subject_id
      WHERE s.class_stream_id = $1
      GROUP BY sub.id, sub.name, sub.code
      ORDER BY sub.name
    `, [streamId]);

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=class_performance_report_${stream.name.replace(/\s+/g, '_')}.pdf`);
    
    generateClassPerformanceReport(res, stream, rankedStudents, subjectAveragesRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating Class Performance Report PDF');
  }
});


// ==========================================
// SPA PRODUCTION BUILD ROUTER
// ==========================================

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Start Server
app.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);
  try {
    await initDb();
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Database failed to initialize:', err);
  }
});
