@echo off
title Kiosk Server

cd /d "C:\project"

taskkill /f /im python.exe >nul 2>&1

start "" chrome --profile-directory="Profile 5" --ignore-profile-directory-if-not-exists --kiosk "http://localhost:8000/index.html"

echo Starting kiosk server...
python -m http.server 8000
