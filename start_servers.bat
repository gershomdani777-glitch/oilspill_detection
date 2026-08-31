@echo off
echo Starting Maritime Oil Spill Detection Platform...

start "Oil Spill Backend API" cmd /k "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
start "Oil Spill Frontend Console" cmd /k "cd frontend && npm run dev -- --host 0.0.0.0 --port 3000"

echo Servers launched!
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000/docs