@echo off
setlocal

title Start Fullstack Project

REM ====== Always run from project root (folder of this .bat) ======
cd /d "%~dp0"

echo ================================
echo Project root: %cd%
echo ================================

REM ====== BACKEND SETUP ======
REM ===== Always run from backend folder =====
cd /d "%~dp0backend"
echo ================================
echo Backend root: %cd%
echo ================================
echo.
echo [1/4] Backend setup...

REM ===== Check Python =====
python --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python not found in PATH
  pause
  exit /b 1
)

REM ===== Create venv if missing =====
if not exist "venv\Scripts\python.exe" (
  echo Creating virtual environment...
  python -m venv venv
)

REM ===== Activate venv =====
call venv\Scripts\activate.bat
if errorlevel 1 (
  echo ERROR: Failed to activate venv
  pause
  exit /b 1
)

REM ===== Install requirements =====
echo Installing backend dependencies...
pip install -r requirements.txt
if errorlevel 1 (
  echo ERROR: pip install failed
  pause
  exit /b 1
)

REM ===== Flask environment =====
REM Nếu bạn dùng app.py
set FLASK_APP=app.py
set FLASK_ENV=development

REM ===== Init migrations (FIRST TIME ONLY) =====
if not exist "migrations\" (
  echo Initializing Flask-Migrate...
  flask db init
  if errorlevel 1 (
    echo ERROR: flask db init failed
    pause
    exit /b 1
  )
)

REM ===== Ensure versions folder exists (CRITICAL FIX) =====
if not exist "migrations\versions\" (
  mkdir "migrations\versions"
)

REM ===== Create migration (safe to run) =====
echo Generating migration...
flask db migrate -m "auto migration"
if errorlevel 1 (
  echo ERROR: flask db migrate failed
  pause
  exit /b 1
)

REM ===== Apply migrations =====
echo Applying migrations...
flask db upgrade
if errorlevel 1 (
  echo ERROR: flask db upgrade failed
  pause
  exit /b 1
)

REM ===== Optional seed =====
if exist "seed.py" (
  echo Seeding database...
  python seed.py
)
echo Database seeded successfully.

REM ====== FRONTEND SETUP ======
echo.
echo [2/4] Frontend setup...

cd /d "%~dp0frontend"
echo ================================
echo Frontend root: %cd%
echo ================================

if not exist "package.json" (
  echo ERROR: Cannot find frontend\package.json
  pause
  exit /b 1
)

echo Installing frontend dependencies...
call npm install
if errorlevel 1 (
  echo ERROR: Failed to install frontend dependencies.
  pause
  exit /b 1
)
echo Frontend dependencies installed successfully.

REM ====== RUN APPS (2 CMD windows) ======
echo.
echo [3/4] All dependencies installed. Automatically starting servers...

REM Backend window - Start in new CMD window
echo Starting BACKEND server...
start "BACKEND Server" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python app.py"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Frontend window - Start in new CMD window
echo Starting FRONTEND server...
start "FRONTEND Server" cmd /k "cd /d "%~dp0frontend" && npm start"

REM Wait for servers to be ready
echo.
echo Waiting for servers to start (10 seconds)...
timeout /t 10 /nobreak >nul

REM ====== OPEN BROWSER ======
echo.
echo [4/4] Opening browser...
REM start http://localhost:3000

echo ================================
echo Done. Backend + Frontend started
echo ================================
echo.
echo Two CMD windows are open:
echo   - BACKEND Server: Running Flask on port 5000
echo   - FRONTEND Server: Running React on port 3000
echo.
echo Browser should open automatically.
echo This window will close automatically in 10 seconds...
echo.
timeout /t 10 /nobreak >nul

exit /b 0