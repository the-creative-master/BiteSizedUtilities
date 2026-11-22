@echo off
rem Serve this folder over http://localhost so the whole site can run.
rem
rem A browser refuses an ES module, a worker, and a page that opens another page
rem when they come off the disk over file:. Serving the folder removes all three
rem refusals at once. Nothing here touches the internet: Python's http.server
rem answers requests from this machine out of this directory and that is all.
rem
rem Usage:  start-server.bat [port]
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=%~1"
if not defined PORT set "PORT=8123"
set "URL=http://localhost:%PORT%/index.html"

rem Python 3 specifically. The `py` launcher that the python.org installer adds
rem comes first, because a bare `python` on Windows is sometimes the Store stub
rem that opens a web page instead of running anything.
set "PY="
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  where python >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  echo This needs Python 3, and none was found on the PATH.
  echo.
  echo Install it from https://www.python.org/downloads/ and tick
  echo "Add python.exe to PATH" during the install, then run this again.
  echo.
  pause
  exit /b 1
)

echo BiteSizedUtilities - serving this folder to this machine only.
echo.
echo The server runs in its own window, titled "BiteSizedUtilities server".
echo Close that window to stop it. This window can be closed at any time.
echo If the port is already taken, run:  start-server.bat 8200
echo.

start "BiteSizedUtilities server" %PY% -m http.server %PORT% --bind 127.0.0.1

rem Two seconds for the server to bind before the browser asks it for anything.
timeout /t 2 /nobreak >nul
start "" "%URL%"

endlocal
exit /b 0
