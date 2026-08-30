@echo off
setlocal
node "%~dp0pia" %*
exit /b %ERRORLEVEL%
