/**
 * Resolves a grade based on the total score and the configuration from grading scales.
 * @param {number|string} totalScore 
 * @param {Array} gradingScales 
 * @returns {string} The resolved grade character (e.g. A, B, C...)
 */
export function resolveGrade(totalScore, gradingScales) {
  const score = parseFloat(totalScore || 0);
  const scale = gradingScales.find(
    s => score >= parseFloat(s.min_score) && score <= parseFloat(s.max_score)
  );
  return scale ? scale.grade : 'F';
}

/**
 * Processes list of students, calculates average score, total marks, and overall stream rank.
 * Handles ties using Olympic-style ranking (e.g. 1st, 2nd, 2nd, 4th).
 * @param {Array} students 
 * @param {Array} scores 
 * @param {Array} gradingScales 
 * @returns {Array} List of students with computed scores, average, overall grade, and rank.
 */
export function processResults(students, scores, gradingScales) {
  // 1. Group scores by student_id
  const scoresByStudent = {};
  scores.forEach(s => {
    const studentId = parseInt(s.student_id, 10);
    if (!scoresByStudent[studentId]) {
      scoresByStudent[studentId] = [];
    }
    scoresByStudent[studentId].push(s);
  });

  // 2. Calculate average and total per student
  const studentMetrics = students.map(student => {
    const studentScores = scoresByStudent[student.id] || [];
    const totalMarks = studentScores.reduce((sum, s) => sum + parseFloat(s.total_score || 0), 0);
    const count = studentScores.length;
    const averageScore = count > 0 ? (totalMarks / count) : 0.0;
    
    // Resolve overall grade based on average score
    const overallGrade = resolveGrade(averageScore, gradingScales);

    return {
      ...student,
      total_marks: totalMarks,
      average_score: averageScore,
      overall_grade: overallGrade,
      subjects_count: count,
      scores: studentScores.map(s => ({
        ...s,
        grade: resolveGrade(s.total_score, gradingScales)
      }))
    };
  });

  // 3. Rank students in the stream
  // Sort by average score descending. If average is same, sort by total marks descending.
  studentMetrics.sort((a, b) => {
    if (b.average_score !== a.average_score) {
      return b.average_score - a.average_score;
    }
    return b.total_marks - a.total_marks;
  });

  // Assign Olympic ranks
  let currentRank = 0;
  let skipped = 0;
  let previousAverage = -1;

  const rankedStudents = studentMetrics.map((student, index) => {
    // Round to 2 decimal places to avoid floating point inequality issues
    const roundedAvg = Math.round(student.average_score * 100) / 100;
    if (roundedAvg !== previousAverage) {
      currentRank = currentRank + skipped + 1;
      skipped = 0;
    } else {
      skipped++;
    }
    previousAverage = roundedAvg;
    return {
      ...student,
      rank: currentRank
    };
  });

  return rankedStudents;
}

/**
 * Computes rankings for a specific subject among a group of student scores.
 * @param {Array} scores 
 * @param {Array} gradingScales 
 * @returns {Array} Scores with subject rank position and grade attached.
 */
export function processSubjectRanks(scores, gradingScales) {
  // Sort scores descending by total_score
  const sortedScores = [...scores].sort((a, b) => parseFloat(b.total_score) - parseFloat(a.total_score));

  let currentRank = 0;
  let skipped = 0;
  let previousTotal = -1;

  const rankedScores = sortedScores.map((scoreRow) => {
    const total = parseFloat(scoreRow.total_score);
    const roundedTotal = Math.round(total * 100) / 100;
    
    if (roundedTotal !== previousTotal) {
      currentRank = currentRank + skipped + 1;
      skipped = 0;
    } else {
      skipped++;
    }
    previousTotal = roundedTotal;
    
    return {
      ...scoreRow,
      grade: resolveGrade(total, gradingScales),
      subject_position: currentRank
    };
  });

  return rankedScores;
}
