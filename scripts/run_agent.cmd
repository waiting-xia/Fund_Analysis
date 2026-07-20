@echo off
setlocal
set "PROJECT_ROOT=%~dp0.."
set "PYTHONPATH=%PROJECT_ROOT%\src"
set "PYTHON=D:\software\Anaconda\envs\Python_310\python.exe"
set "FUND_CODE=%~1"
set "REPORT_TYPE=%~2"
if "%FUND_CODE%"=="" set "FUND_CODE=510300"
if "%REPORT_TYPE%"=="" set "REPORT_TYPE=on_demand"
"%PYTHON%" -m fund_agent.cli "%FUND_CODE%" --report-type "%REPORT_TYPE%"
exit /b %ERRORLEVEL%
