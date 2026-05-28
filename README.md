# Annapurni Foods Full-Stack App

A modern, fast, and beautiful local web application for Annapurni Foods.

## Tech Stack
- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: Local JSON file (`server/data/db.json`)

## Setup & Running Locally

1. **Install Dependencies**
   Navigate to the project root (`annapurni-app`) and install frontend packages:
   ```bash
   npm install
   ```
   Navigate to the `server` directory and install backend packages:
   ```bash
   cd server
   npm install
   ```

2. **Start the Backend (API)**
   In the `server` folder, start the backend server:
   ```bash
   node index.js
   ```
   The backend will run on `http://localhost:3001`.

3. **Start the Frontend (React Vite)**
   Open a new terminal window, navigate to the `annapurni-app` root folder, and run:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`.

## Admin Access
- Navigate to `http://localhost:5173/admin/login`
- Use the credentials defined in `server/.env`:
  - **Username**: `admin`
  - **Password**: `password123`

## Features
- Updates to products or settings in the Admin Dashboard immediately sync to `db.json` and reflect on the public site without needing to rebuild.
- WhatsApp CTA intelligently links the product name or combo request.
