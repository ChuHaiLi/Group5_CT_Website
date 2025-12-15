# Backend - Flask API

This is the backend API built with Flask, providing endpoints for the application.

## Requirements

- Python 3.8+
- pip
- virtualenv (recommended)

## Installation

1. Create and activate a virtual environment:
```bash
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Database Setup

Initialize and update the database using Flask-Migrate:

### 1. Initialize migration folder (run once only)
```bash
flask db init
```

### 2. Create migration file from models
```bash
flask db migrate -m "initial migration"
```

### 3. Apply migration to database
```bash
flask db upgrade
```

### 4. Seed Vietnam location data

Run the script to import provinces/cities and tourist destinations in Vietnam:
```bash
python seed.py
```

## Run Server

Start the Flask development server:
```bash
python app.py
```

The server will run at: `http://localhost:5000`

## Useful Commands
```bash
# Create new migration after modifying models
flask db migrate -m "description of changes"

# Apply migration
flask db upgrade

# Rollback migration
flask db downgrade

# View migration history
flask db history
```

## Environment Variables

Create a `.env` file in the backend directory with the following variables (if needed):
```
FLASK_APP=app.py
FLASK_ENV=development
DATABASE_URL=sqlite:///app.db
SECRET_KEY=your-secret-key
```

## API Endpoints

API documentation will be updated once endpoints are completed.

## Notes

- Ensure the virtual environment is activated before running any commands
- The `seed.py` file should be run after the database has been migrated
- Vietnam location data will be automatically imported when running `seed.py`