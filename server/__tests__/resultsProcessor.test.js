import test from 'node:test';
import assert from 'node:assert';
import { resolveGrade, processResults, processSubjectRanks } from '../resultsProcessor.js';

// Setup Mock Grading Scale Configurations
const mockGradingScales = [
  { grade: 'A', min_score: 80.0, max_score: 100.0, remarks: 'Excellent' },
  { grade: 'B', min_score: 70.0, max_score: 79.99, remarks: 'Very Good' },
  { grade: 'C', min_score: 60.0, max_score: 69.99, remarks: 'Good' },
  { grade: 'D', min_score: 50.0, max_score: 59.99, remarks: 'Pass' },
  { grade: 'F', min_score: 0.0, max_score: 49.99, remarks: 'Fail' }
];

test('resultsProcessor - resolveGrade() mapping', () => {
  // Edge cases and standard cases
  assert.strictEqual(resolveGrade(95, mockGradingScales), 'A');
  assert.strictEqual(resolveGrade(80, mockGradingScales), 'A');
  assert.strictEqual(resolveGrade(75, mockGradingScales), 'B');
  assert.strictEqual(resolveGrade(70, mockGradingScales), 'B');
  assert.strictEqual(resolveGrade(65, mockGradingScales), 'C');
  assert.strictEqual(resolveGrade(50, mockGradingScales), 'D');
  assert.strictEqual(resolveGrade(45, mockGradingScales), 'F');
  assert.strictEqual(resolveGrade(0, mockGradingScales), 'F');
});

test('resultsProcessor - processResults() metrics and ranking', () => {
  const students = [
    { id: 1, name: 'Alice', admission_number: 'A01' },
    { id: 2, name: 'Bob', admission_number: 'A02' },
    { id: 3, name: 'Charlie', admission_number: 'A03' }
  ];

  // Bob has average 90, Alice has average 80, Charlie has average 50
  const scores = [
    { student_id: 1, subject_id: 10, total_score: 80 }, // Alice Math
    { student_id: 1, subject_id: 11, total_score: 80 }, // Alice English (Avg = 80)
    { student_id: 2, subject_id: 10, total_score: 90 }, // Bob Math
    { student_id: 2, subject_id: 11, total_score: 90 }, // Bob English (Avg = 90)
    { student_id: 3, subject_id: 10, total_score: 50 }, // Charlie Math (Avg = 50)
  ];

  const results = processResults(students, scores, mockGradingScales);

  // Check count
  assert.strictEqual(results.length, 3);
  
  // Bob should be Rank 1
  assert.strictEqual(results[0].name, 'Bob');
  assert.strictEqual(results[0].rank, 1);
  assert.strictEqual(results[0].average_score, 90);
  assert.strictEqual(results[0].overall_grade, 'A');

  // Alice should be Rank 2
  assert.strictEqual(results[1].name, 'Alice');
  assert.strictEqual(results[1].rank, 2);
  assert.strictEqual(results[1].average_score, 80);
  assert.strictEqual(results[1].overall_grade, 'A');

  // Charlie should be Rank 3
  assert.strictEqual(results[2].name, 'Charlie');
  assert.strictEqual(results[2].rank, 3);
  assert.strictEqual(results[2].average_score, 50);
  assert.strictEqual(results[2].overall_grade, 'D');
});

test('resultsProcessor - processResults() tie-breaking (Olympic ranking)', () => {
  const students = [
    { id: 1, name: 'Alice', admission_number: 'A01' },
    { id: 2, name: 'Bob', admission_number: 'A02' },
    { id: 3, name: 'Charlie', admission_number: 'A03' },
    { id: 4, name: 'David', admission_number: 'A04' }
  ];

  // Alice: 80
  // Bob: 80 (Tying for 1st)
  // Charlie: 80 (Tying for 1st)
  // David: 70 (Should be 4th, NOT 2nd or 3rd)
  const scores = [
    { student_id: 1, subject_id: 10, total_score: 80 },
    { student_id: 2, subject_id: 10, total_score: 80 },
    { student_id: 3, subject_id: 10, total_score: 80 },
    { student_id: 4, subject_id: 10, total_score: 70 },
  ];

  const results = processResults(students, scores, mockGradingScales);
  
  // Ranks should be 1, 1, 1, 4
  const rank1Students = results.filter(s => s.rank === 1);
  assert.strictEqual(rank1Students.length, 3);
  
  const studentDavid = results.find(s => s.name === 'David');
  assert.strictEqual(studentDavid.rank, 4);
});

test('resultsProcessor - processSubjectRanks() ordering and position', () => {
  const subjectScores = [
    { student_id: 1, total_score: 85.5 },
    { student_id: 2, total_score: 92.0 },
    { student_id: 3, total_score: 85.5 },
  ];

  const rankedScores = processSubjectRanks(subjectScores, mockGradingScales);

  // Expected positions:
  // Student 2 (92.0): Position 1
  // Student 1 (85.5): Position 2
  // Student 3 (85.5): Position 2
  
  const score2 = rankedScores.find(s => s.student_id === 2);
  const score1 = rankedScores.find(s => s.student_id === 1);
  const score3 = rankedScores.find(s => s.student_id === 3);

  assert.strictEqual(score2.subject_position, 1);
  assert.strictEqual(score2.grade, 'A');
  
  assert.strictEqual(score1.subject_position, 2);
  assert.strictEqual(score1.grade, 'A');

  assert.strictEqual(score3.subject_position, 2);
  assert.strictEqual(score3.grade, 'A');
});
