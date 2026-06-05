-- Drop tables if they exist (for easy resetting/testing)
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS class_stream_subjects CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS class_streams CASCADE;
DROP TABLE IF EXISTS grading_scales CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- Create Class Streams
CREATE TABLE class_streams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- e.g., "Form 1 Green", "Form 2 Blue"
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4), -- 1, 2, 3, 4
    color VARCHAR(20) NOT NULL CHECK (color IN ('Green', 'Yellow', 'Orange', 'Blue')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Students Table
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    admission_number VARCHAR(50) UNIQUE NOT NULL,
    class_stream_id INTEGER NOT NULL REFERENCES class_streams(id) ON DELETE RESTRICT,
    email VARCHAR(100),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Subjects Table
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL, -- e.g., "MATH101", "ENG101"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction Table: Subjects offered by a Class Stream
CREATE TABLE class_stream_subjects (
    class_stream_id INTEGER REFERENCES class_streams(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (class_stream_id, subject_id)
);

-- Scores Table: Records student performance per subject
CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    continuous_assessment NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- e.g. max 30
    exam NUMERIC(5, 2) NOT NULL DEFAULT 0.00,                  -- e.g. max 70
    total_score NUMERIC(5, 2) GENERATED ALWAYS AS (continuous_assessment + exam) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_subject_score UNIQUE (student_id, subject_id)
);

-- Grading Scales (Editable via Settings)
CREATE TABLE grading_scales (
    id SERIAL PRIMARY KEY,
    grade VARCHAR(5) UNIQUE NOT NULL, -- A, B, C, D, F
    min_score NUMERIC(5, 2) NOT NULL,
    max_score NUMERIC(5, 2) NOT NULL,
    remarks VARCHAR(100),
    CONSTRAINT check_scale CHECK (min_score <= max_score)
);

-- Score System Configurations (Editable via Settings)
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value VARCHAR(100) NOT NULL
);

-- Indexes for performance optimization
CREATE INDEX idx_students_stream ON students(class_stream_id);
CREATE INDEX idx_scores_student ON scores(student_id);
CREATE INDEX idx_scores_subject ON scores(subject_id);
CREATE INDEX idx_class_stream_subjects_subject ON class_stream_subjects(subject_id);
