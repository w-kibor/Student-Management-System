# Ikonex Academy - Student Management System User Guide

Welcome to the **Student Management System (SMS)** for Ikonex Academy. This document serves as a comprehensive guide for setting up the system locally, deploying it to production, and understanding its core features.

---

## 📖 Table of Contents
1. [System Architecture](#-system-architecture)
2. [Local Setup & Development](#-local-setup--development)
3. [Deployment Guide](#-deployment-guide)
4. [Core Features & Usage](#-core-features--usage)
5. [Testing & Quality Assurance](#-testing--quality-assurance)

---

## 🏗️ System Architecture

The Student Management System uses a decoupled full-stack architecture:
*   **Frontend**: React (Vite-powered SPA) with Vanilla CSS styling for a modern, glassmorphic UI.
*   **Backend**: Node.js and Express API server handling database operations, Olympic ranking calculations, and PDF generation.
*   **Database**: PostgreSQL for robust data integrity.

---

## 💻 Local Setup & Development

### 1. Prerequisites
Ensure you have the following installed on your local machine:
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   [Docker](https://www.docker.com/) and Docker Compose (to run the database)

### 2. Installation Steps
Clone the project and run the following in your terminal:
```bash
# Install all dependencies (frontend and backend)
npm install
```

### 3. Spin Up PostgreSQL Database
The project includes a `docker-compose.yml` file to quickly launch a local PostgreSQL container mapped to port `5433` (preventing conflicts with default PostgreSQL ports):
```bash
docker compose up -d
```

### 4. Running the Application
Start both the React dev server and the Express API server concurrently:
```bash
npm run dev
```
*   **React Client**: Runs at `http://localhost:5173`
*   **Express Backend**: Runs at `http://localhost:5000`

*Note: Vite is pre-configured with a proxy (`/api`) to forward all API calls to the local Express backend.*

---

## 🚀 Deployment Guide

Follow these steps to host your application in a production environment:

### Step 1: Push Local Code Changes
Ensure all local commits are pushed to your GitHub repository:
```bash
git push origin main
```

### Step 2: Deploy PostgreSQL Database on Render
1. Log in to the [Render Console](https://dashboard.render.com).
2. Click **New +** and select **PostgreSQL**.
3. Set the database name to `ikonex-academy-db` and select the **Free** tier.
4. Once created and status changes to **Active**, copy the **External Connection String** (or **Internal Connection String** if running the Web Service in the same region).

### Step 3: Deploy Express Backend on Render
1. Click **New +** on Render and select **Web Service**.
2. Connect your GitHub repository.
3. Configure the following service settings:
   *   **Name**: `ikonex-sms-backend`
   *   **Build Command**: `npm install --include=dev; npm run build` (or `npm install` if serving assets strictly via Vercel)
   *   **Start Command**: `node server.js`
4. Expand **Advanced/Environment Variables** and add:
   *   `NODE_ENV` = `production`
   *   `DATABASE_URL` = *[Paste your PostgreSQL Connection String]*
5. Click **Create Web Service**. Once deployed, copy your backend's primary URL (e.g., `https://ikonex-sms-backend.onrender.com`).

### Step 4: Deploy Frontend on Vercel
1. Log in to [Vercel](https://vercel.com).
2. Import your GitHub repository.
3. Configure settings:
   *   **Framework Preset**: Vite
   *   **Build Command**: `npm run build`
   *   **Output Directory**: `dist`
4. Add the following **Environment Variable**:
   *   **Key**: `VITE_API_URL`
   *   **Value**: *[Paste your Render Web Service URL]* (ensure there is **no** trailing slash).
5. Click **Deploy**.

---

## ⚙️ Core Features & Usage

### 🎨 1. Class Stream Management
*   **Navigation**: Click on the **Class Streams** tab.
*   **Creating a Stream**: Click **Add Stream**, choose a Grade (Form 1 to 4), and select a color theme (Green, Yellow, Orange, Blue, or write in a custom color).
*   **Visual Color-Coding**: Streams are color-coded dynamically (e.g., Form 1 Green utilizes an emerald gradient, Form 2 Yellow uses amber) to make classification quick and readable.

### 👥 2. Student & Subject Registration
*   **Registering a Student**: Click **Students** > **Add Student**. Supply the student's name, unique Admission Number, and assign them to a Class Stream.
*   **Subject Setup**: Manage curriculum under **Subjects**. Create subjects (e.g., Mathematics, English) and link them to respective Class Streams to customize which classes take which exams.

### 📝 3. Grading Grid (Bulk Entry)
*   **Bulk Scores Panel**: Go to the **Scoring Sheet** page.
*   **Entry Matrix**: Select a Class Stream and a Subject. The system displays a spreadsheet-style table with all students in that stream.
*   **Validation**: Enter Continuous Assessment (**CA**) and **Exam** marks. The system dynamically validates entries (CA max `30`, Exam max `70` by default).
*   **Bulk Save**: Click **Save Scores** to update all student records in a single database transaction.

### 🏆 4. Results & Rankings Engine
*   **Olympic Tie-Breaker**: The system automatically computes overall positions using standard Olympic ranking rules (e.g., if two students tie for 1st place, they both receive 1st, and the next student is ranked 3rd).
*   **Averages & Remarks**: Averages, totals, letter grades, and performance remarks (e.g., Excellent, Pass, Fail) are resolved instantly using the custom configuration scales.

### 📄 5. PDF Reports Hub
*   **Report Card Generator**: Download a polished, professional individual PDF Report Card for any student detailing their scores, grades, subject-specific positions, averages, and final class rank.
*   **Class Summary**: Generate a stream-wide PDF Class Performance Report displaying averages across subjects, top performers, and a master rank sheet.

---

## 🧪 Testing & Quality Assurance

The system is equipped with automated tests using Node.js's native test runner to guarantee the reliability of the grades processor and database integrity.

To execute the test suite locally, run:
```bash
npm test
```
This tests:
*   Database initialization & seeding operations.
*   Letter grade resolutions.
*   Total averages and ranking metrics.
*   Olympic tie-breaking accuracy.
