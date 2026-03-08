@echo off
title 게스트하우스 키오스크 서버 실행기

:: 1. 프로젝트 폴더로 이동
cd /d "C:\project"

:: 2. 이미 실행 중인 파이썬 서버가 있다면 종료 (충돌 방지)
taskkill /f /im python.exe >nul 2>&1

:: 3. 브라우저 자동 실행 (서버가 뜨기 전 미리 명령을 예약)
:: 전체 절대 경로 대신 시스템에 등록된 'chrome' 명령어를 직접 사용합니다.
start "" chrome --profile-directory="Profile 5" --ignore-profile-directory-if-not-exists --kiosk "http://localhost:8000/index.html"

:: 4. 파이썬 웹 서버 실행
echo 키오스크 서버를 시작합니다...
python -m http.server 8000
