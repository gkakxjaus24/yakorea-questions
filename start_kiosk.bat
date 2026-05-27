@echo off
title Kiosk Server

cd /d "C:\project"

REM 기존 인스턴스 정리
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im chrome.exe  >nul 2>&1

REM 1) 로컬 웹 서버를 최소화된 별도 창에서 실행
start "KioskServer" /min cmd /c "cd /d C:\project && python -m http.server 8000"

REM 2) 서버가 뜰 시간을 잠깐 준 뒤 키 잠금 + Chrome 제어 스크립트 실행
REM    (kiosk_lock.ahk 가 Chrome 실행/감시/키차단/비밀종료를 모두 담당)
timeout /t 2 /nobreak >nul
start "" "C:\project\kiosk_lock.ahk"
