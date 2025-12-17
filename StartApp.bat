@echo off
setlocal

title Start Fullstack Project

REM ====== Always run from project root (folder of this .bat) ======
cd /d "%~dp0"

echo ================================
echo Project root: %cd%
echo ================================

REM ====== BACKEND SETUP ======
echo.
echo [1/4] Backend setup...

if not exist "backend\" (
  echo ERROR: Cannot find backend folder.
  pause
  exit /b 1
)

cd /d "%~dp0backend"

REM Create venv only if not exists
if not exist "venv\Scripts\python.exe" (
  echo Creating venv...
  python -m venv venv
)

echo Activating venv...
call venv\Scripts\activate.bat

echo Installing backend requirements...
pip install -r requirements.txt
if errorlevel 1 (
  echo ERROR: Failed to install backend requirements.
  pause
  exit /b 1
)
echo Backend dependencies installed successfully.

echo Optional: seed database (only if database is empty)
echo Uncomment the lines below if you want to seed every time
echo Running seed...
python seed.py
if errorlevel 1 (
  echo ERROR: Failed to seed database.
  pause
  exit /b 1
)
echo Database seeded successfully.

REM ====== FRONTEND SETUP ======
echo.
echo [2/4] Frontend setup...

cd /d "%~dp0frontend"

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
