import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';

const API_BASE = import.meta.env.VITE_API_URL || '';
const apiFetch = (url, options) => window.fetch(url.startsWith('/api') ? `${API_BASE}${url}` : url, options);

export default function App() {
  // Navigation & UI States
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data States
  const [streams, setStreams] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [gradingScales, setGradingScales] = useState([]);
  const [limits, setLimits] = useState({ ca_max: 30, exam_max: 70 });

  // Loading & Action States
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  
  // Modals & Selection States
  const [selectedStudent, setSelectedStudent] = useState(null); // for student detail modal
  const [selectedStream, setSelectedStream] = useState(null); // for stream detail modal
  const [activeStudentModal, setActiveStudentModal] = useState(null); // 'create', 'edit'
  const [activeSubjectModal, setActiveSubjectModal] = useState(null); // 'create', 'edit'
  const [activeStreamModal, setActiveStreamModal] = useState(null); // 'create'
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [customColorVal, setCustomColorVal] = useState('');
  
  // Forms States
  const [studentForm, setStudentForm] = useState({ id: '', name: '', admission_number: '', class_stream_id: '', email: '', date_of_birth: '' });
  const [subjectForm, setSubjectForm] = useState({ id: '', name: '', code: '' });
  const [streamForm, setStreamForm] = useState({ name: '', grade: 1, color: 'Green' });
  const [assignSubjectsState, setAssignSubjectsState] = useState([]); // Array of checked subject IDs
  
  // Search & Filters
  const [studentSearch, setStudentSearch] = useState('');
  const [streamFilter, setStreamFilter] = useState('');
  
  // Scores View States
  const [scoreStreamId, setScoreStreamId] = useState('');
  const [scoreSubjectId, setScoreSubjectId] = useState('');
  const [scoresSheet, setScoresSheet] = useState([]);
  const [scoresLimits, setScoresLimits] = useState({ ca_max: 30, exam_max: 70 });
  
  // Reports View States
  const [reportStreamId, setReportStreamId] = useState('');
  const [reportRankings, setReportRankings] = useState([]);
  const [reportSubjectAverages, setReportSubjectAverages] = useState([]);
  const [reportStreamInfo, setReportStreamInfo] = useState(null);

  // Settings View States
  const [configForm, setConfigForm] = useState({ ca_max: 30, exam_max: 70 });
  const [gradesConfig, setGradesConfig] = useState([]);

  // ==========================================
  // NOTIFICATIONS (TOASTS)
  // ==========================================
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // ==========================================
  // FETCH ROUTINES
  // ==========================================
  const fetchStreams = async () => {
    try {
      const res = await apiFetch('/api/streams');
      const data = await res.json();
      setStreams(data);
    } catch (err) {
      showToast('Error loading streams', 'danger');
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiFetch('/api/students');
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      showToast('Error loading students', 'danger');
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await apiFetch('/api/subjects');
      const data = await res.json();
      setSubjects(data);
    } catch (err) {
      showToast('Error loading subjects', 'danger');
    }
  };

  const fetchGradingScales = async () => {
    try {
      const res = await apiFetch('/api/settings/grades');
      const data = await res.json();
      setGradingScales(data);
      setGradesConfig(data);
    } catch (err) {
      showToast('Error loading grading configuration', 'danger');
    }
  };

  const fetchSystemLimits = async () => {
    try {
      const res = await apiFetch('/api/settings/configs');
      const data = await res.json();
      setLimits(data);
      setConfigForm(data);
    } catch (err) {
      showToast('Error loading configurations', 'danger');
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchStreams(),
      fetchStudents(),
      fetchSubjects(),
      fetchGradingScales(),
      fetchSystemLimits()
    ]).finally(() => setLoading(false));
  }, []);

  // Sync data on tab change
  useEffect(() => {
    if (currentView === 'dashboard') {
      fetchStudents();
      fetchStreams();
    } else if (currentView === 'students') {
      fetchStudents();
    } else if (currentView === 'streams') {
      fetchStreams();
    } else if (currentView === 'subjects') {
      fetchSubjects();
    }
  }, [currentView]);

  // ==========================================
  // ACTIONS / CRUDS
  // ==========================================

  // Student Actions
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    const isEdit = !!studentForm.id;
    const url = isEdit ? `/api/students/${studentForm.id}` : '/api/students';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      
      showToast(isEdit ? 'Student updated successfully!' : 'Student registered successfully!');
      fetchStudents();
      setActiveStudentModal(null);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const deleteStudent = async (id) => {
    if (!confirm('Are you sure you want to delete this student? All score records will be lost.')) return;
    try {
      const res = await apiFetch(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      showToast('Student deleted successfully');
      fetchStudents();
      if (selectedStudent && selectedStudent.id === id) setSelectedStudent(null);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const openEditStudent = (student) => {
    setStudentForm({
      id: student.id,
      name: student.name,
      admission_number: student.admission_number,
      class_stream_id: student.class_stream_id,
      email: student.email || '',
      date_of_birth: student.date_of_birth ? student.date_of_birth.substring(0, 10) : ''
    });
    setActiveStudentModal('edit');
  };

  const openCreateStudent = () => {
    setStudentForm({ id: '', name: '', admission_number: '', class_stream_id: streams[0]?.id || '', email: '', date_of_birth: '' });
    setActiveStudentModal('create');
  };

  const viewStudentDetails = async (id) => {
    try {
      const res = await apiFetch(`/api/students/${id}`);
      if (!res.ok) throw new Error('Student not found');
      const data = await res.json();
      
      // Calculate overall total score and average on client for viewing
      const studentScores = data.scores || [];
      const total = studentScores.reduce((sum, s) => sum + parseFloat(s.total_score || 0), 0);
      const avg = studentScores.length > 0 ? (total / studentScores.length) : 0;
      
      setSelectedStudent({
        ...data,
        total_marks: total,
        average_score: avg
      });
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Subject Actions
  const handleSubjectSubmit = async (e) => {
    e.preventDefault();
    const isEdit = !!subjectForm.id;
    const url = isEdit ? `/api/subjects/${subjectForm.id}` : '/api/subjects';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subjectForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      
      showToast(isEdit ? 'Subject updated successfully!' : 'Subject created successfully!');
      fetchSubjects();
      setActiveSubjectModal(null);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const deleteSubject = async (id) => {
    if (!confirm('Are you sure you want to delete this subject? It will be removed from all class streams and scoring databases.')) return;
    try {
      const res = await apiFetch(`/api/subjects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      showToast('Subject deleted successfully');
      fetchSubjects();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const openEditSubject = (subject) => {
    setSubjectForm(subject);
    setActiveSubjectModal('edit');
  };

  const openCreateSubject = () => {
    setSubjectForm({ id: '', name: '', code: '' });
    setActiveSubjectModal('create');
  };

  // Class Stream Actions
  const handleStreamSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create stream');
      showToast('Class Stream created successfully!');
      fetchStreams();
      setActiveStreamModal(null);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const viewStreamDetails = async (id) => {
    try {
      const res = await apiFetch(`/api/streams/${id}`);
      if (!res.ok) throw new Error('Stream details not found');
      const data = await res.json();
      setSelectedStream(data);
      setAssignSubjectsState(data.subjects.map(s => s.id));
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleAssignSubjects = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/streams/${selectedStream.id}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_ids: assignSubjectsState })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save assignments');
      
      showToast('Subjects assigned successfully!');
      viewStreamDetails(selectedStream.id); // Refresh
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Scores Matric Actions
  const loadScoresSheet = async () => {
    if (!scoreStreamId || !scoreSubjectId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/scores/stream/${scoreStreamId}/subject/${scoreSubjectId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load scorecard grid');
      setScoresSheet(data.scores);
      setScoresLimits(data.limits);
    } catch (err) {
      showToast(err.message, 'danger');
      setScoresSheet([]);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (studentId, field, val) => {
    setScoresSheet(prev => prev.map(row => {
      if (row.student_id === studentId) {
        const numVal = val === '' ? '' : parseFloat(val);
        const updatedRow = { ...row, [field]: numVal };
        const ca = parseFloat(updatedRow.continuous_assessment || 0);
        const exam = parseFloat(updatedRow.exam || 0);
        updatedRow.total_score = ca + exam;
        return updatedRow;
      }
      return row;
    }));
  };

  const saveScoresSheet = async () => {
    // Validate scores first
    let hasError = false;
    scoresSheet.forEach(s => {
      const ca = parseFloat(s.continuous_assessment || 0);
      const exam = parseFloat(s.exam || 0);
      if (ca < 0 || ca > scoresLimits.ca_max || exam < 0 || exam > scoresLimits.exam_max) {
        hasError = true;
      }
    });

    if (hasError) {
      showToast(`Invalid scores. CA must be 0-${scoresLimits.ca_max}, Exam must be 0-${scoresLimits.exam_max}`, 'danger');
      return;
    }

    try {
      const res = await apiFetch('/api/scores/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: scoreStreamId,
          subject_id: scoreSubjectId,
          scores: scoresSheet
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save scores');
      
      showToast('All scores saved successfully!');
      loadScoresSheet(); // Reload to get fresh calculations
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Reports Views actions
  const loadReportRankings = async () => {
    if (!reportStreamId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/reports/stream/${reportStreamId}/rankings`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to calculate rankings');
      setReportRankings(data.students);
      setReportSubjectAverages(data.subjectAverages);
      setReportStreamInfo(data.stream);
    } catch (err) {
      showToast(err.message, 'danger');
      setReportRankings([]);
      setReportSubjectAverages([]);
    } finally {
      setLoading(false);
    }
  };

  // Settings configs
  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/settings/configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update system config');
      showToast('Settings saved successfully!');
      fetchSystemLimits();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleGradesSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/settings/grades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scales: gradesConfig })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update grading config');
      showToast('Grading scales updated successfully!');
      fetchGradingScales();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleGradeScaleChange = (index, field, value) => {
    setGradesConfig(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Helper function to resolve grade label on frontend
  const getGradeLabel = (score) => {
    const sc = parseFloat(score || 0);
    const scale = gradingScales.find(s => sc >= parseFloat(s.min_score) && sc <= parseFloat(s.max_score));
    return scale ? scale.grade : 'F';
  };

  // ==========================================
  // FRONTEND GRAPH DATA BUILDERS
  // ==========================================
  const buildStreamChartData = () => {
    if (streams.length === 0) return { labels: [], datasets: [] };
    
    // Group student counts by grade
    const gradeCounts = { 'Form 1': 0, 'Form 2': 0, 'Form 3': 0, 'Form 4': 0 };
    streams.forEach(st => {
      const label = `Form ${st.grade}`;
      if (gradeCounts[label] !== undefined) {
        gradeCounts[label] += st.student_count || 0;
      }
    });

    return {
      labels: Object.keys(gradeCounts),
      datasets: [
        {
          label: 'Students Enrolled',
          data: Object.values(gradeCounts),
          backgroundColor: 'rgba(99, 102, 241, 0.4)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1.5,
          borderRadius: 6,
        }
      ]
    };
  };

  // Top overall students for Dashboard Card
  const getTopStudents = () => {
    // Just sort current student list or show mock summary if not loaded.
    // For a real solution, we can sort them, but let's select a few who have marks
    return students
      .filter(s => s.average_score !== undefined)
      .sort((a, b) => b.average_score - a.average_score)
      .slice(0, 5);
  };

  // Filter students based on filter inputs
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                          student.admission_number.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesStream = streamFilter ? student.class_stream_id === parseInt(streamFilter, 10) : true;
    return matchesSearch && matchesStream;
  });

  return (
    <div className="app-container">
      {/* Toast Notification Stack */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.message}</span>
            <button className="close-btn" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>&times;</button>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo-section">
          <div className="logo-icon">I</div>
          <h2>Ikonex Academy</h2>
        </div>

        <ul className="nav-links">
          <li className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentView('dashboard'); setSidebarOpen(false); }}>
              <span>📊</span> Dashboard
            </button>
          </li>
          <li className={`nav-item ${currentView === 'streams' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentView('streams'); setSidebarOpen(false); }}>
              <span>🏫</span> Class Streams
            </button>
          </li>
          <li className={`nav-item ${currentView === 'students' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentView('students'); setSidebarOpen(false); }}>
              <span>👥</span> Students
            </button>
          </li>
          <li className={`nav-item ${currentView === 'subjects' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentView('subjects'); setSidebarOpen(false); }}>
              <span>📚</span> Subjects
            </button>
          </li>
          <li className={`nav-item ${currentView === 'scores' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentView('scores'); setSidebarOpen(false); }}>
              <span>📝</span> Scoring Sheet
            </button>
          </li>
          <li className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentView('reports'); setSidebarOpen(false); }}>
              <span>📋</span> Reports Hub
            </button>
          </li>
          <li className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}>
            <button onClick={() => { setCurrentView('settings'); setSidebarOpen(false); }}>
              <span>⚙️</span> Config Settings
            </button>
          </li>
        </ul>

        <div className="nav-footer">
          <p>SMS v1.0.0</p>
          <p>© 2026 Ikonex Academy</p>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="main-content">
        <header className="top-header">
          <div className="page-title">
            <button className="btn btn-secondary btn-sm md-hide" style={{ marginRight: '10px' }} onClick={() => setSidebarOpen(!sidebarOpen)}>Menu</button>
            <h1>{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h1>
            <p>School Management System Panel</p>
          </div>
          <div className="header-meta">
            <div className="status-badge">
              <span className="status-dot"></span>
              PostgreSQL Connected (Port 5433)
            </div>
          </div>
        </header>

        {loading && (
          <div className="loader-container">
            <div className="spinner"></div>
            <p>Processing database requests...</p>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 1: DASHBOARD                                                   */}
        {/* =================================================================== */}
        {!loading && currentView === 'dashboard' && (
          <div>
            <div className="metrics-grid">
              <div className="glass-card metric-card">
                <div className="metric-info">
                  <h3>Total Enrolled</h3>
                  <p>{students.length}</p>
                </div>
                <div className="metric-icon blue">👥</div>
              </div>
              <div className="glass-card metric-card">
                <div className="metric-info">
                  <h3>Class Streams</h3>
                  <p>{streams.length}</p>
                </div>
                <div className="metric-icon indigo">🏫</div>
              </div>
              <div className="glass-card metric-card">
                <div className="metric-info">
                  <h3>Active Subjects</h3>
                  <p>{subjects.length}</p>
                </div>
                <div className="metric-icon orange">📚</div>
              </div>
              <div className="glass-card metric-card">
                <div className="metric-info">
                  <h3>Passing Grade</h3>
                  <p>{limits.ca_max + limits.exam_max === 100 ? '50%' : 'Pass D'}</p>
                </div>
                <div className="metric-icon green">🏆</div>
              </div>
            </div>

            <div className="dashboard-details">
              <div className="glass-card">
                <div className="card-header">
                  <h2>Enrollment by Form Grade</h2>
                </div>
                <div className="card-body" style={{ height: '320px' }}>
                  <ChartComponent data={buildStreamChartData()} type="bar" />
                </div>
              </div>

              <div className="glass-card">
                <div className="card-header">
                  <h2>Quick Actions</h2>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button className="btn btn-primary" onClick={openCreateStudent}>➕ Register Student</button>
                  <button className="btn btn-secondary" onClick={() => setCurrentView('scores')}>📝 Enter CA & Exams</button>
                  <button className="btn btn-secondary" onClick={() => setCurrentView('reports')}>📋 View Class Rankings</button>
                  <button className="btn btn-secondary" onClick={openCreateSubject}>📚 Add Subject</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: CLASS STREAMS                                               */}
        {/* =================================================================== */}
        {!loading && currentView === 'streams' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>All School Streams</h2>
              <button className="btn btn-primary btn-sm" onClick={() => { setStreamForm({ name: 'Form 1 Green', grade: 1, color: 'Green' }); setIsCustomColor(false); setCustomColorVal(''); setActiveStreamModal(true); }}>➕ Add Stream</button>
            </div>

            <div className="streams-grid">
              {streams.map(st => (
                <div key={st.id} className={`glass-card stream-card ${st.color.toLowerCase()}`}>
                  <div className="stream-card-title">
                    <h3>{st.name}</h3>
                    <span className={`stream-badge ${st.color.toLowerCase()}`}>{st.color}</span>
                  </div>
                  <div className="stream-stats">
                    <div className="stream-stat-item">
                      <span>Students</span>
                      <strong>{st.student_count || 0}</strong>
                    </div>
                    <div className="stream-stat-item">
                      <span>Grade</span>
                      <strong>F{st.grade}</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => viewStreamDetails(st.id)}>Manage Stream</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 3: STUDENTS                                                    */}
        {/* =================================================================== */}
        {!loading && currentView === 'students' && (
          <div className="glass-card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '15px' }}>
              <h2>Student Register</h2>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Search name or admin..." 
                  className="form-control"
                  style={{ width: '200px' }}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                
                <select 
                  className="form-control" 
                  style={{ width: '160px' }}
                  value={streamFilter}
                  onChange={(e) => setStreamFilter(e.target.value)}
                >
                  <option value="">All Streams</option>
                  {streams.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>

                <button className="btn btn-primary" onClick={openCreateStudent}>➕ Register Student</button>
              </div>
            </div>

            <div className="card-body">
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Admission No</th>
                      <th>Full Name</th>
                      <th>Class Stream</th>
                      <th>Email Address</th>
                      <th>Date of Birth</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '30px' }}>
                          No students found. Register a student to get started.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(st => (
                        <tr key={st.id}>
                          <td><strong>{st.admission_number}</strong></td>
                          <td>
                            <button 
                              style={{ background: 'none', border: 'none', color: 'var(--color-secondary)', fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}
                              onClick={() => viewStudentDetails(st.id)}
                            >
                              {st.name}
                            </button>
                          </td>
                          <td>
                            <span className={`stream-badge ${(st.stream_color || 'blue').toLowerCase()}`}>
                              {st.stream_name}
                            </span>
                          </td>
                          <td>{st.email || '-'}</td>
                          <td>{st.date_of_birth ? new Date(st.date_of_birth).toLocaleDateString() : '-'}</td>
                          <td>
                            <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEditStudent(st)}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteStudent(st.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 4: SUBJECTS                                                    */}
        {/* =================================================================== */}
        {!loading && currentView === 'subjects' && (
          <div className="glass-card" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div className="card-header">
              <h2>Subject Manager</h2>
              <button className="btn btn-primary btn-sm" onClick={openCreateSubject}>➕ Create Subject</button>
            </div>
            <div className="card-body">
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Subject Name</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
                          No subjects registered.
                        </td>
                      </tr>
                    ) : (
                      subjects.map(sub => (
                        <tr key={sub.id}>
                          <td><span style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--stream-orange)', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{sub.code}</span></td>
                          <td><strong>{sub.name}</strong></td>
                          <td>
                            <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEditSubject(sub)}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteSubject(sub.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 5: SCORING SHEET                                               */}
        {/* =================================================================== */}
        {!loading && currentView === 'scores' && (
          <div className="glass-card">
            <div className="card-header">
              <h2>Spreadsheet Scoring Sheet</h2>
              {scoresSheet.length > 0 && (
                <button className="btn btn-primary" onClick={saveScoresSheet}>💾 Save Grades</button>
              )}
            </div>

            <div className="card-body">
              <div className="score-matrix-header">
                <div className="form-group">
                  <label>Class Stream</label>
                  <select 
                    className="form-control" 
                    value={scoreStreamId} 
                    onChange={(e) => { setScoreStreamId(e.target.value); setScoresSheet([]); }}
                  >
                    <option value="">Select Stream</option>
                    {streams.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Subject</label>
                  <select 
                    className="form-control" 
                    value={scoreSubjectId} 
                    onChange={(e) => { setScoreSubjectId(e.target.value); setScoresSheet([]); }}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                    ))}
                  </select>
                </div>

                <button 
                  className="btn btn-secondary" 
                  style={{ height: '42px' }}
                  onClick={loadScoresSheet}
                  disabled={!scoreStreamId || !scoreSubjectId}
                >
                  🔍 Load Students
                </button>
              </div>

              {scoresSheet.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--color-text-muted)' }}>
                  Select a Class Stream and Subject, then click Load Students to open the score spreadsheet grid.
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Admission No</th>
                        <th>Student Name</th>
                        <th style={{ textAlign: 'center' }}>CA (Max {scoresLimits.ca_max})</th>
                        <th style={{ textAlign: 'center' }}>Exam (Max {scoresLimits.exam_max})</th>
                        <th style={{ textAlign: 'center' }}>Total Score</th>
                        <th style={{ textAlign: 'center' }}>Expected Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoresSheet.map(row => {
                        const ca = parseFloat(row.continuous_assessment || 0);
                        const exam = parseFloat(row.exam || 0);
                        const isCaInvalid = ca < 0 || ca > scoresLimits.ca_max;
                        const isExamInvalid = exam < 0 || exam > scoresLimits.exam_max;
                        const total = ca + exam;

                        return (
                          <tr key={row.student_id}>
                            <td>{row.admission_number}</td>
                            <td><strong>{row.student_name}</strong></td>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="number" 
                                className={`score-input ${isCaInvalid ? 'invalid' : ''}`}
                                value={row.continuous_assessment}
                                onChange={(e) => handleScoreChange(row.student_id, 'continuous_assessment', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="number" 
                                className={`score-input ${isExamInvalid ? 'invalid' : ''}`}
                                value={row.exam}
                                onChange={(e) => handleScoreChange(row.student_id, 'exam', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="total-score-badge">{total.toFixed(1)}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`grade-badge ${getGradeLabel(total)}`}>
                                {getGradeLabel(total)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 6: REPORTS HUB                                                 */}
        {/* =================================================================== */}
        {!loading && currentView === 'reports' && (
          <div className="glass-card">
            <div className="card-header">
              <h2>Reports Generator & Rankings</h2>
            </div>
            <div className="card-body">
              <div className="score-matrix-header" style={{ marginBottom: '30px' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Select Stream to Calculate Rankings</label>
                  <select 
                    className="form-control" 
                    value={reportStreamId} 
                    onChange={(e) => { setReportStreamId(e.target.value); setReportRankings([]); }}
                  >
                    <option value="">Select Stream</option>
                    {streams.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ height: '42px' }}
                  onClick={loadReportRankings}
                  disabled={!reportStreamId}
                >
                  🧮 Process Results & Ranks
                </button>
                {reportRankings.length > 0 && (
                  <a 
                    href={`${API_BASE}/api/reports/stream/${reportStreamId}/pdf`}
                    target="_blank" 
                    className="btn btn-secondary"
                    style={{ height: '42px', textDecoration: 'none' }}
                  >
                    📄 PDF Class Report
                  </a>
                )}
              </div>

              {reportRankings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--color-text-muted)' }}>
                  Select a class stream and click Process Results. This will calculate total/averages, assign Olympic ranks, compute grades, and show rankings.
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '25px' }}>
                    <h3>Subject Performance Averages</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {reportSubjectAverages.map(subAvg => (
                        <div key={subAvg.id} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--glass-border)', display: 'flex', gap: '15px' }}>
                          <span style={{ color: 'var(--stream-orange)', fontWeight: 'bold' }}>{subAvg.code}</span>
                          <span>{subAvg.name}</span>
                          <strong>{parseFloat(subAvg.average_score || 0).toFixed(1)}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <h3>Stream Rankings List</h3>
                  <div className="table-container" style={{ marginTop: '15px' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'center', width: '60px' }}>Rank</th>
                          <th>Admission No</th>
                          <th>Student Name</th>
                          <th style={{ textAlign: 'center' }}>Average</th>
                          <th style={{ textAlign: 'center' }}>Grade</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportRankings.map(student => (
                          <tr key={student.id}>
                            <td style={{ textAlign: 'center' }}><strong>{student.rank}</strong></td>
                            <td>{student.admission_number}</td>
                            <td><strong>{student.name}</strong></td>
                            <td style={{ textAlign: 'center', color: 'var(--color-secondary)', fontWeight: 'bold' }}>
                              {parseFloat(student.average_score || 0).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`grade-badge ${student.overall_grade}`}>
                                {student.overall_grade}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <a 
                                href={`${API_BASE}/api/reports/student/${student.id}/pdf`}
                                target="_blank"
                                className="btn btn-secondary btn-sm"
                                style={{ textDecoration: 'none' }}
                              >
                                🖨️ PDF Report Card
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 7: CONFIG SETTINGS                                             */}
        {/* =================================================================== */}
        {!loading && currentView === 'settings' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            {/* System settings thresholds */}
            <div className="glass-card">
              <div className="card-header">
                <h2>Continuous Assessment & Exam Limits</h2>
              </div>
              <form onSubmit={handleConfigSubmit} className="card-body">
                <div className="form-group">
                  <label>Maximum Continuous Assessment (CA) Score</label>
                  <input 
                    type="number" 
                    className="form-control"
                    value={configForm.ca_max}
                    onChange={(e) => setConfigForm({ ...configForm, ca_max: parseInt(e.target.value, 10) })}
                    min="1"
                    max="100"
                    required
                  />
                  <small style={{ color: 'var(--color-text-dark)', marginTop: '4px', display: 'block' }}>Default is 30 points.</small>
                </div>
                
                <div className="form-group">
                  <label>Maximum Exam Score</label>
                  <input 
                    type="number" 
                    className="form-control"
                    value={configForm.exam_max}
                    onChange={(e) => setConfigForm({ ...configForm, exam_max: parseInt(e.target.value, 10) })}
                    min="1"
                    max="100"
                    required
                  />
                  <small style={{ color: 'var(--color-text-dark)', marginTop: '4px', display: 'block' }}>Default is 70 points. Total points will equal (CA + Exam) which usually sums to 100.</small>
                </div>

                <button type="submit" className="btn btn-primary">Save Configurations</button>
              </form>
            </div>

            {/* Grading scales */}
            <div className="glass-card">
              <div className="card-header">
                <h2>Grading Scale brackets</h2>
              </div>
              <form onSubmit={handleGradesSubmit} className="card-body">
                {gradesConfig.map((item, index) => (
                  <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', width: '30px', color: 'var(--color-primary)' }}>{item.grade}</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      placeholder="Min" 
                      value={item.min_score}
                      onChange={(e) => handleGradeScaleChange(index, 'min_score', e.target.value)}
                    />
                    <span>to</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      placeholder="Max" 
                      value={item.max_score}
                      onChange={(e) => handleGradeScaleChange(index, 'max_score', e.target.value)}
                    />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Remarks" 
                      value={item.remarks}
                      style={{ flex: 1.5 }}
                      onChange={(e) => handleGradeScaleChange(index, 'remarks', e.target.value)}
                    />
                  </div>
                ))}
                
                <button type="submit" className="btn btn-primary" style={{ marginTop: '15px' }}>Save Grading Scales</button>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 1: STUDENT REGISTRATION / EDIT                                */}
        {/* =================================================================== */}
        {activeStudentModal && (
          <div className="modal-backdrop" onClick={() => setActiveStudentModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{activeStudentModal === 'create' ? 'Register New Student' : 'Edit Student Information'}</h3>
                <button className="close-btn" onClick={() => setActiveStudentModal(null)}>&times;</button>
              </div>
              <form onSubmit={handleStudentSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Full Student Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. John Doe"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Admission Number (Unique ID)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. IA-2026-0041"
                      value={studentForm.admission_number}
                      onChange={(e) => setStudentForm({ ...studentForm, admission_number: e.target.value })}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Assigned Class Stream</label>
                    <select 
                      className="form-control"
                      value={studentForm.class_stream_id}
                      onChange={(e) => setStudentForm({ ...studentForm, class_stream_id: e.target.value })}
                      required
                    >
                      {streams.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Email (Optional)</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        placeholder="john.doe@gmail.com"
                        value={studentForm.email}
                        onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={studentForm.date_of_birth}
                        onChange={(e) => setStudentForm({ ...studentForm, date_of_birth: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveStudentModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{activeStudentModal === 'create' ? 'Register Student' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 2: STUDENT DETAILS (SCORECARD CARD)                           */}
        {/* =================================================================== */}
        {selectedStudent && (
          <div className="modal-backdrop" onClick={() => setSelectedStudent(null)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Student Profile & Scorecard Card</h3>
                <button className="close-btn" onClick={() => setSelectedStudent(null)}>&times;</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    <h4 style={{ color: 'var(--color-primary)', marginBottom: '10px', fontSize: '15px' }}>Personal Profile</h4>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>Name:</strong> {selectedStudent.name}</p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>Adm No:</strong> {selectedStudent.admission_number}</p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>Stream:</strong> {selectedStudent.stream_name}</p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>Email:</strong> {selectedStudent.email || '-'}</p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>DOB:</strong> {selectedStudent.date_of_birth ? new Date(selectedStudent.date_of_birth).toLocaleDateString() : '-'}</p>
                    
                    <h4 style={{ color: 'var(--color-secondary)', marginTop: '20px', marginBottom: '10px', fontSize: '15px' }}>Overall Stats</h4>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>Subjects Taken:</strong> {selectedStudent.scores.length}</p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>Total Marks:</strong> {selectedStudent.total_marks.toFixed(1)}</p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>Average Score:</strong> {selectedStudent.average_score.toFixed(2)}%</p>
                    <p style={{ margin: '6px 0', fontSize: '13px' }}><strong>Grade:</strong> {getGradeLabel(selectedStudent.average_score)}</p>
                  </div>

                  <div>
                    <h4 style={{ marginBottom: '10px', fontSize: '15px' }}>Subject Marks Breakdowns</h4>
                    <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table className="custom-table" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th style={{ textAlign: 'center' }}>CA</th>
                            <th style={{ textAlign: 'center' }}>Exam</th>
                            <th style={{ textAlign: 'center' }}>Total</th>
                            <th style={{ textAlign: 'center' }}>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStudent.scores.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px' }}>
                                No scores recorded yet.
                              </td>
                            </tr>
                          ) : (
                            selectedStudent.scores.map(sc => (
                              <tr key={sc.id}>
                                <td><strong>{sc.subject_name}</strong> ({sc.subject_code})</td>
                                <td style={{ textAlign: 'center' }}>{parseFloat(sc.continuous_assessment).toFixed(1)}</td>
                                <td style={{ textAlign: 'center' }}>{parseFloat(sc.exam).toFixed(1)}</td>
                                <td style={{ textAlign: 'center', color: 'var(--color-secondary)', fontWeight: 'bold' }}>{parseFloat(sc.total_score).toFixed(1)}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`grade-badge ${getGradeLabel(sc.total_score)}`}>
                                    {getGradeLabel(sc.total_score)}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                      <a 
                        href={`${API_BASE}/api/reports/student/${selectedStudent.id}/pdf`}
                        target="_blank"
                        className="btn btn-primary btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        🖨️ Download Report Card PDF
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedStudent(null)}>Close Profile</button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 3: SUBJECT REGISTRATION / EDIT                                */}
        {/* =================================================================== */}
        {activeSubjectModal && (
          <div className="modal-backdrop" onClick={() => setActiveSubjectModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{activeSubjectModal === 'create' ? 'Create New Subject' : 'Edit Subject Details'}</h3>
                <button className="close-btn" onClick={() => setActiveSubjectModal(null)}>&times;</button>
              </div>
              <form onSubmit={handleSubjectSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Subject Title</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Mathematics"
                      value={subjectForm.name}
                      onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Subject Code (Abbreviated)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. MATH"
                      value={subjectForm.code}
                      onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                      required 
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveSubjectModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{activeSubjectModal === 'create' ? 'Create Subject' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 4: CLASS STREAM DETAIL & SUBJECT ASSIGNMENT                   */}
        {/* =================================================================== */}
        {selectedStream && (
          <div className="modal-backdrop" onClick={() => setSelectedStream(null)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Manage Stream: {selectedStream.name}</h3>
                <button className="close-btn" onClick={() => setSelectedStream(null)}>&times;</button>
              </div>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                {/* Left panel: Enrolled Students */}
                <div>
                  <h4 style={{ marginBottom: '12px', color: 'var(--color-secondary)' }}>Enrolled Students ({selectedStream.students.length})</h4>
                  <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Adm No</th>
                          <th>Full Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStream.students.length === 0 ? (
                          <tr>
                            <td colSpan="2" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px' }}>
                              No students registered in this stream.
                            </td>
                          </tr>
                        ) : (
                          selectedStream.students.map(s => (
                            <tr key={s.id}>
                              <td>{s.admission_number}</td>
                              <td><strong>{s.name}</strong></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right panel: Offered Subjects assignments */}
                <div>
                  <h4 style={{ marginBottom: '12px', color: 'var(--stream-orange)' }}>Offered Subjects</h4>
                  
                  <form onSubmit={handleAssignSubjects}>
                    <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--glass-border)', padding: '15px', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {subjects.map(sub => {
                        const isChecked = assignSubjectsState.includes(sub.id);
                        return (
                          <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13.5px' }}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignSubjectsState([...assignSubjectsState, sub.id]);
                                } else {
                                  setAssignSubjectsState(assignSubjectsState.filter(id => id !== sub.id));
                                }
                              }}
                            />
                            <strong>{sub.code}</strong> - {sub.name}
                          </label>
                        );
                      })}
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '15px' }}>
                      💾 Save Offered Subjects
                    </button>
                  </form>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedStream(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 5: CREATE CLASS STREAM                                        */}
        {/* =================================================================== */}
        {activeStreamModal && (
          <div className="modal-backdrop" onClick={() => setActiveStreamModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Create New Class Stream</h3>
                <button className="close-btn" onClick={() => setActiveStreamModal(null)}>&times;</button>
              </div>
              <form onSubmit={handleStreamSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Form Grade Level</label>
                    <select 
                      className="form-control"
                      value={streamForm.grade}
                      onChange={(e) => {
                        const gr = parseInt(e.target.value, 10);
                        setStreamForm({ ...streamForm, grade: gr, name: `Form ${gr} ${streamForm.color}` });
                      }}
                    >
                      <option value="1">Form 1</option>
                      <option value="2">Form 2</option>
                      <option value="3">Form 3</option>
                      <option value="4">Form 4</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Stream Color Accent</label>
                    <select 
                      className="form-control"
                      value={isCustomColor ? 'Custom' : streamForm.color}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Custom') {
                          setIsCustomColor(true);
                          const col = customColorVal || 'Red';
                          setStreamForm({ ...streamForm, color: col, name: `Form ${streamForm.grade} ${col}` });
                        } else {
                          setIsCustomColor(false);
                          setStreamForm({ ...streamForm, color: val, name: `Form ${streamForm.grade} ${val}` });
                        }
                      }}
                    >
                      <option value="Green">Green</option>
                      <option value="Yellow">Yellow</option>
                      <option value="Orange">Orange</option>
                      <option value="Blue">Blue</option>
                      <option value="Red">Red</option>
                      <option value="Purple">Purple</option>
                      <option value="Teal">Teal</option>
                      <option value="Pink">Pink</option>
                      <option value="Gold">Gold</option>
                      <option value="Custom">Custom Color...</option>
                    </select>
                  </div>

                  {isCustomColor && (
                    <div className="form-group">
                      <label>Enter Custom Color Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. Red, Silver, Gold..."
                        value={customColorVal}
                        onChange={(e) => {
                          const col = e.target.value;
                          const capitalizedCol = col ? col.charAt(0).toUpperCase() + col.slice(1) : '';
                          setCustomColorVal(col);
                          setStreamForm({ ...streamForm, color: capitalizedCol || 'Custom', name: `Form ${streamForm.grade} ${capitalizedCol || 'Custom'}` });
                        }}
                        required
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Computed Stream Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={streamForm.name}
                      readOnly
                      style={{ background: 'rgba(255, 255, 255, 0.02)', color: 'var(--color-text-muted)' }}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveStreamModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Class Stream</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
