@echo off
rem GradeWise test site: double-click to start. First run sets up Python packages.
cd /d "%~dp0"

if exist .venv\Scripts\python.exe goto install

echo First start: creating the Python environment (takes a minute)...
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 -m venv .venv
) else (
    python -m venv .venv
)
if not exist .venv\Scripts\python.exe (
    echo.
    echo Python was not found. Install it from https://www.python.org/downloads/
    echo ^(tick "Add python.exe to PATH" during setup^), then double-click start.bat again.
    pause
    exit /b 1
)

:install
rem quick when nothing changed; picks up new packages after a code update
.venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
    echo.
    echo Installing the packages failed: see the messages above.
    pause
    exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
    echo.
    echo NOTE: Git is not installed, so your tests stay on this PC only.
    echo Install it with:  winget install --id Git.Git -e   then restart start.bat
    echo.
)

.venv\Scripts\python.exe webapp.py --open
pause
