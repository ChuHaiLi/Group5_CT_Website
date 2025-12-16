# Full Stack Application - Setup & Running Guide

This is a full-stack web application with a React frontend and Flask backend API.

## Project Structure

```
project-root/
├── frontend/          # React application
├── backend/           # Flask API
└── .env              # Shared environment variables (optional)
```

## Prerequisites

- Node.js and npm (for frontend)
- Python 3.8+ (for backend)
- pip and virtualenv (for backend)

---

## Frontend Setup (React)

The frontend is bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Installation

Navigate to the frontend directory:
```bash
cd frontend
npm install
npm install --legacy-peer-deps (if the version is not compatible)
```

### Available Scripts

**Development Mode:**
```bash
npm start
```
- Runs the app at [http://localhost:3000](http://localhost:3000)
- Auto-reloads on code changes
- Shows lint errors in console

**Production Build:**
```bash
npm run build
```
- Creates optimized production build in `build/` folder
- Minifies files and includes hashes in filenames
- Ready for deployment

**Testing:**
```bash
npm test
```
- Launches test runner in interactive watch mode

### Environment Variables

The frontend supports reading from a central `.env` file at the repository root. When running `npm start` or `npm run build`, the script `scripts/load-root-env.js` automatically copies FIREBASE and GOOGLE values from the root `.env` into `frontend/.env.local` with `REACT_APP_*` prefix.

Alternatively, you can manually manage `frontend/.env.local`.

---

## Backend Setup (Flask API)

### Installation

Navigate to the backend directory:
```bash
cd backend
```

**1. Create and activate virtual environment:**
```bash
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

**2. Install dependencies:**
```bash
pip install -r requirements.txt
```

### Database Setup

Initialize and configure the database using Flask-Migrate:

**1. Initialize migration folder (first time only):**
```bash
flask db init
```

**2. Create migration from models:**
```bash
flask db migrate -m "initial migration"
```

**3. Apply migration to database:**
```bash
flask db upgrade
```

**4. Seed Vietnam location data:**
```bash
python seed.py
```
This imports provinces/cities and tourist destinations in Vietnam.

### Run Backend Server

```bash
python app.py
```
The API server will run at: [http://localhost:5000](http://localhost:5000)

### Useful Database Commands

```bash
# Create new migration after model changes
flask db migrate -m "description of changes"

# Apply migrations
flask db upgrade

# Rollback migration
flask db downgrade

# View migration history
flask db history
```

### Environment Variables

Create a `.env` file in the backend directory:
```
FLASK_APP=app.py
FLASK_ENV=development
DATABASE_URL=sqlite:///app.db
SECRET_KEY=your-secret-key
```

---

## Running the Full Application

### Step 1: Start Backend
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py
```
Backend runs at: http://localhost:5000

### Step 2: Start Frontend
Open a new terminal:
```bash
cd frontend
npm start
```
Frontend runs at: http://localhost:3000

The React app will communicate with the Flask API on port 5000.

---

## Additional Resources

- [Create React App Documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React Documentation](https://reactjs.org/)
- [Flask Documentation](https://flask.palletsprojects.com/)

---

## Notes

- Always activate the virtual environment before running backend commands
- Run `seed.py` after database migration to populate Vietnam location data
- Ensure both frontend and backend servers are running for full functionality
- API documentation will be updated as endpoints are completed
