import PDFDocument from 'pdfkit';

/**
 * Generates an individual PDF Report Card for a student and streams it to the HTTP response.
 * @param {Object} res Node.js Response object
 * @param {Object} student Student info with computed total_marks, average_score, overall_grade, and rank
 * @param {Array} scores List of scores for this student
 * @param {number} streamSize Total number of students in this stream
 * @param {Array} gradingScales Configuration of grade ranges
 */
export function generateStudentReportCard(res, student, scores, streamSize, gradingScales) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  // Stream PDF directly to response
  doc.pipe(res);

  // Background Border
  doc.rect(20, 20, 555, 802).lineWidth(1.5).stroke('#1e1b4b'); // deep indigo border
  doc.rect(23, 23, 549, 796).lineWidth(0.5).stroke('#312e81');

  // Header Title
  doc.fillColor('#1e1b4b').fontSize(22).font('Helvetica-Bold').text('IKONEX ACADEMY', 40, 50, { align: 'center' });
  doc.fillColor('#475569').fontSize(10).font('Helvetica').text('Academic Excellence & Character Development', 40, 75, { align: 'center' });
  
  // Decorative horizontal lines
  doc.moveTo(40, 92).lineTo(555, 92).lineWidth(2).stroke('#4f46e5');
  doc.moveTo(40, 96).lineTo(555, 96).lineWidth(0.5).stroke('#cbd5e1');

  doc.fillColor('#1e1b4b').fontSize(13).font('Helvetica-Bold').text('STUDENT PROGRESS REPORT CARD', 40, 110, { align: 'center' });

  // Student details panel
  doc.rect(40, 130, 515, 75).fill('#f8fafc').stroke('#e2e8f0');
  
  doc.fillColor('#4f46e5').fontSize(9.5).font('Helvetica-Bold');
  doc.text('Student Name:', 55, 142);
  doc.text('Admission No:', 55, 162);
  doc.text('Class Stream:', 55, 182);

  doc.fillColor('#1e293b').font('Helvetica');
  doc.text(student.name, 150, 142);
  doc.text(student.admission_number, 150, 162);
  doc.text(student.stream_name || 'N/A', 150, 182);

  doc.fillColor('#4f46e5').font('Helvetica-Bold');
  doc.text('Term / Period:', 320, 142);
  doc.text('Class Position:', 320, 162);
  doc.text('Stream Size:', 320, 182);

  doc.fillColor('#1e293b').font('Helvetica');
  doc.text('First Term (Current)', 420, 142);
  doc.text(student.rank ? `${student.rank} of ${streamSize}` : 'N/A', 420, 162);
  doc.text(`${streamSize} Students`, 420, 182);

  // Subject Scores Table
  const tableTop = 225;
  doc.fillColor('#1e1b4b').fontSize(11).font('Helvetica-Bold').text('Academic Performance', 40, tableTop - 15);

  // Table header
  doc.rect(40, tableTop, 515, 20).fill('#4f46e5');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Subject Name', 45, tableTop + 6, { width: 180 });
  doc.text('Code', 230, tableTop + 6, { width: 45, align: 'center' });
  doc.text('CA (30)', 280, tableTop + 6, { width: 45, align: 'center' });
  doc.text('Exam (70)', 330, tableTop + 6, { width: 50, align: 'center' });
  doc.text('Total (100)', 385, tableTop + 6, { width: 55, align: 'center' });
  doc.text('Grade', 445, tableTop + 6, { width: 40, align: 'center' });
  doc.text('Position', 490, tableTop + 6, { width: 60, align: 'center' });

  // Rows mapping
  let y = tableTop + 20;
  doc.fillColor('#1e293b').font('Helvetica').fontSize(8.5);
  
  if (!scores || scores.length === 0) {
    doc.rect(40, y, 515, 25).stroke('#e2e8f0');
    doc.text('No subject scores recorded yet for this student.', 45, y + 8, { width: 505, align: 'center' });
    y += 25;
  } else {
    scores.forEach((row, idx) => {
      if (idx % 2 === 1) {
        doc.rect(40, y, 515, 18).fill('#f8fafc');
      }
      doc.rect(40, y, 515, 18).stroke('#e2e8f0');
      
      doc.fillColor('#1e293b');
      doc.text(row.subject_name || 'N/A', 45, y + 5, { width: 180 });
      doc.text(row.subject_code || 'N/A', 230, y + 5, { width: 45, align: 'center' });
      doc.text(parseFloat(row.continuous_assessment).toFixed(1), 280, y + 5, { width: 45, align: 'center' });
      doc.text(parseFloat(row.exam).toFixed(1), 330, y + 5, { width: 50, align: 'center' });
      doc.text(parseFloat(row.total_score).toFixed(1), 385, y + 5, { width: 55, align: 'center' });
      
      if (row.grade === 'F') {
        doc.fillColor('#ef4444').font('Helvetica-Bold');
      } else if (row.grade === 'A') {
        doc.fillColor('#10b981').font('Helvetica-Bold');
      } else {
        doc.fillColor('#1e293b').font('Helvetica-Bold');
      }
      doc.text(row.grade, 445, y + 5, { width: 40, align: 'center' });
      doc.fillColor('#1e293b').font('Helvetica');
      
      doc.text(row.subject_position ? `${row.subject_position}` : '-', 490, y + 5, { width: 60, align: 'center' });
      y += 18;
    });
  }

  // Summary card
  const summaryTop = y + 15;
  doc.rect(40, summaryTop, 515, 45).fill('#f1f5f9').stroke('#cbd5e1');
  
  doc.fillColor('#4f46e5').fontSize(9).font('Helvetica-Bold');
  doc.text('TOTAL MARKS', 55, summaryTop + 10, { width: 100, align: 'center' });
  doc.text('AVERAGE SCORE', 200, summaryTop + 10, { width: 110, align: 'center' });
  doc.text('OVERALL GRADE', 350, summaryTop + 10, { width: 90, align: 'center' });
  doc.text('FINAL POSITION', 460, summaryTop + 10, { width: 85, align: 'center' });

  doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold');
  doc.text(parseFloat(student.total_marks || 0).toFixed(1), 55, summaryTop + 24, { width: 100, align: 'center' });
  doc.text(parseFloat(student.average_score || 0).toFixed(2), 200, summaryTop + 24, { width: 110, align: 'center' });
  
  if (student.overall_grade === 'F') {
    doc.fillColor('#ef4444');
  } else if (student.overall_grade === 'A') {
    doc.fillColor('#10b981');
  }
  doc.text(student.overall_grade || 'F', 350, summaryTop + 24, { width: 90, align: 'center' });
  doc.fillColor('#1e293b');
  doc.text(student.rank ? `${student.rank} / ${streamSize}` : 'N/A', 460, summaryTop + 24, { width: 85, align: 'center' });

  // Scale Legend
  const scaleTop = summaryTop + 75;
  doc.fillColor('#1e1b4b').fontSize(11).font('Helvetica-Bold').text('Grading Scale Legend', 40, scaleTop - 15);
  
  doc.rect(40, scaleTop, 515, 15).fill('#475569');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('Grade', 50, scaleTop + 4, { width: 60 });
  doc.text('Score Range', 120, scaleTop + 4, { width: 120 });
  doc.text('Remarks', 250, scaleTop + 4, { width: 200 });

  let sy = scaleTop + 15;
  doc.fillColor('#1e293b').font('Helvetica').fontSize(8);
  gradingScales.forEach((gs, idx) => {
    if (idx % 2 === 1) {
      doc.rect(40, sy, 515, 12).fill('#f8fafc');
    }
    doc.rect(40, sy, 515, 12).stroke('#e2e8f0');
    doc.fillColor('#1e293b');
    doc.text(gs.grade, 50, sy + 2, { width: 60 });
    doc.text(`${parseFloat(gs.min_score).toFixed(1)} - ${parseFloat(gs.max_score).toFixed(1)}`, 120, sy + 2, { width: 120 });
    doc.text(gs.remarks, 250, sy + 2, { width: 200 });
    sy += 12;
  });

  // Footer/Signatures
  const footerTop = 720;
  doc.moveTo(40, footerTop).lineTo(180, footerTop).lineWidth(1).stroke('#94a3b8');
  doc.moveTo(375, footerTop).lineTo(515, footerTop).lineWidth(1).stroke('#94a3b8');

  doc.fillColor('#64748b').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Class Teacher Signature', 40, footerTop + 5, { width: 140, align: 'center' });
  doc.text('Principal Signature', 375, footerTop + 5, { width: 140, align: 'center' });

  doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('Ikonex Academy SMS Report Card • System Generated', 40, 770, { align: 'center' });

  doc.end();
}

/**
 * Generates class summary report and streams it to the HTTP response.
 * @param {Object} res Node.js Response object
 * @param {Object} stream Stream info
 * @param {Array} rankedStudents Sorted students with metrics
 * @param {Array} subjectAverages Subject average list
 */
export function generateClassPerformanceReport(res, stream, rankedStudents, subjectAverages) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  doc.pipe(res);

  // Background Border
  doc.rect(20, 20, 555, 802).lineWidth(1.5).stroke('#1e1b4b');

  // Header Title
  doc.fillColor('#1e1b4b').fontSize(22).font('Helvetica-Bold').text('IKONEX ACADEMY', 40, 50, { align: 'center' });
  doc.fillColor('#4f46e5').fontSize(13).font('Helvetica-Bold').text('CLASS STREAM PERFORMANCE REPORT', 40, 75, { align: 'center' });
  
  // Decorative lines
  doc.moveTo(40, 92).lineTo(555, 92).lineWidth(2).stroke('#4f46e5');

  // Metadata Panel
  doc.fillColor('#1e293b').fontSize(9.5).font('Helvetica-Bold').text(`Class Stream: `, 40, 108);
  doc.font('Helvetica').text(stream.name, 120, 108);
  doc.font('Helvetica-Bold').text(`Total Enrolled: `, 40, 123);
  doc.font('Helvetica').text(`${rankedStudents.length} Students`, 120, 123);

  doc.font('Helvetica-Bold').text(`Report Period: `, 350, 108);
  doc.font('Helvetica').text('First Term (Current)', 430, 108);
  doc.font('Helvetica-Bold').text(`Generated On: `, 350, 123);
  doc.font('Helvetica').text(new Date().toLocaleDateString(), 430, 123);

  // Subject Performance Averages
  const subTop = 150;
  doc.fillColor('#1e1b4b').fontSize(11).font('Helvetica-Bold').text('Subject Averages', 40, subTop);
  
  let sy = subTop + 15;
  if (!subjectAverages || subjectAverages.length === 0) {
    doc.rect(40, sy, 515, 25).stroke('#e2e8f0');
    doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').text('No scores recorded in this stream.', 45, sy + 8, { align: 'center' });
    sy += 25;
  } else {
    doc.rect(40, sy, 515, 18).fill('#475569');
    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
    doc.text('Subject Code', 55, sy + 5, { width: 100 });
    doc.text('Subject Name', 160, sy + 5, { width: 220 });
    doc.text('Average Score', 390, sy + 5, { width: 150, align: 'right' });
    sy += 18;

    subjectAverages.forEach((subAvg, idx) => {
      if (idx % 2 === 1) {
        doc.rect(40, sy, 515, 15).fill('#f8fafc');
      }
      doc.rect(40, sy, 515, 15).stroke('#e2e8f0');
      doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica');
      doc.text(subAvg.code || '', 55, sy + 4, { width: 100 });
      doc.text(subAvg.name || '', 160, sy + 4, { width: 220 });
      doc.font('Helvetica-Bold').text(parseFloat(subAvg.average_score || 0).toFixed(2), 390, sy + 4, { width: 150, align: 'right' });
      sy += 15;
    });
  }

  // Student Rankings Table
  const rankingsTop = sy + 15;
  doc.fillColor('#1e1b4b').fontSize(11).font('Helvetica-Bold').text('Student Rankings', 40, rankingsTop);

  let ry = rankingsTop + 15;
  doc.rect(40, ry, 515, 18).fill('#4f46e5');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Rank', 45, ry + 5, { width: 40, align: 'center' });
  doc.text('Admission No', 95, ry + 5, { width: 100 });
  doc.text('Student Name', 205, ry + 5, { width: 200 });
  doc.text('Average', 415, ry + 5, { width: 70, align: 'center' });
  doc.text('Grade', 495, ry + 5, { width: 50, align: 'center' });
  ry += 18;

  doc.fontSize(8).font('Helvetica');
  rankedStudents.forEach((student, idx) => {
    // Check height limits
    if (ry > 720) {
      doc.fillColor('#94a3b8').text(`Page ${doc.page ? doc.page.index + 1 : 1}`, 40, 770, { align: 'center' });
      doc.addPage();
      doc.rect(20, 20, 555, 802).lineWidth(1.5).stroke('#1e1b4b');
      
      // Header for next page
      doc.fillColor('#1e1b4b').fontSize(9).font('Helvetica-Bold').text(`Class Stream: ${stream.name} - Student Rankings (Cont.)`, 40, 40);
      doc.moveTo(40, 52).lineTo(555, 52).lineWidth(1).stroke('#4f46e5');
      ry = 60;

      // Header row
      doc.rect(40, ry, 515, 18).fill('#4f46e5');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Rank', 45, ry + 5, { width: 40, align: 'center' });
      doc.text('Admission No', 95, ry + 5, { width: 100 });
      doc.text('Student Name', 205, ry + 5, { width: 200 });
      doc.text('Average', 415, ry + 5, { width: 70, align: 'center' });
      doc.text('Grade', 495, ry + 5, { width: 50, align: 'center' });
      ry += 18;
    }

    if (idx % 2 === 1) {
      doc.rect(40, ry, 515, 15).fill('#f8fafc');
    }
    doc.rect(40, ry, 515, 15).stroke('#e2e8f0');

    doc.fillColor('#1e293b').fontSize(8);
    doc.font('Helvetica-Bold').text(student.rank.toString(), 45, ry + 4, { width: 40, align: 'center' });
    doc.font('Helvetica').text(student.admission_number, 95, ry + 4, { width: 100 });
    doc.text(student.name, 205, ry + 4, { width: 200 });
    doc.font('Helvetica-Bold').text(parseFloat(student.average_score || 0).toFixed(2), 415, ry + 4, { width: 70, align: 'center' });
    doc.text(student.overall_grade || 'F', 495, ry + 4, { width: 50, align: 'center' });

    ry += 15;
  });

  doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('Ikonex Academy SMS Report • System Generated', 40, 770, { align: 'center' });

  doc.end();
}
