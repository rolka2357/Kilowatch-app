@echo off
REM All heavy build caches go to D: so C: does not fill up.
set KILOWATCH_RELEASE=1
set GRADLE_USER_HOME=D:\build-cache\gradle
set TEMP=D:\build-cache\temp
set TMP=D:\build-cache\temp
if not exist "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%"
if not exist "%TEMP%" mkdir "%TEMP%"
cd /d "%~dp0"
node scripts\build-release-apk.js
