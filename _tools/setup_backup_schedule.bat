@echo off
REM ============================================================
REM One-time installer: create Windows scheduled tasks to run
REM hexo blog auto backup (daily 22:00 + 5 min after each logon).
REM Double-click this file ONCE to install. Safe to re-run.
REM ============================================================

schtasks /Create /F /TN "HexoBlogAutoBackup" /TR "D:\hexo_blog\_tools\backup_blog.bat" /SC DAILY /ST 22:00
if errorlevel 1 goto :fail

schtasks /Create /F /TN "HexoBlogBackupOnLogon" /TR "D:\hexo_blog\_tools\backup_blog.bat" /SC ONLOGON /DELAY 0005:00
if errorlevel 1 goto :fail

echo.
echo === Verify ===
schtasks /Query /TN "HexoBlogAutoBackup" | findstr /I "TaskName Next Run Status"
schtasks /Query /TN "HexoBlogBackupOnLogon" | findstr /I "TaskName Next Run Status"
echo.
echo SUCCESS: auto backup tasks installed.
echo - Daily at 22:00 (HexoBlogAutoBackup)
echo - 5 minutes after each logon (HexoBlogBackupOnLogon)
echo - Logs at D:\hexo_blog\_tools\backup.log
echo.
pause
exit /b 0

:fail
echo.
echo FAILED to create scheduled task. Right-click this file and
echo "Run as administrator" if you are not admin user, then retry.
pause
exit /b 1
