# Tasks — Ya Korea Hostel Chat System

## 진행 원칙
- 현재 Phase만 작업 → 테스트 통과 → git commit → 사용자 승인 → 다음 Phase
- 테스트 실패 시 다음 Phase 절대 진행 금지

---

## Phase 1: 서버 기반 구축 + 자동 테스트 [x]
**목표**: Express + Socket.IO 서버 실행, health 엔드포인트 확인

작업 목록:
- [x] `server/` 폴더 초기화 (`npm init`, 의존성 설치)
- [x] `src/index.js` — Express + Socket.IO 서버 (PORT 환경변수)
- [x] `GET /api/health` — `{ status: 'ok', timestamp }` 반환
- [x] Socket.IO 연결/해제 console.log
- [x] `src/tests/phase1.test.js` — curl health + 소켓 연결 자동 테스트

**검증 기준**:
- `/api/health` 200 응답
- 소켓 connect/disconnect 이벤트 정상 로그

---

## Phase 2: Supabase 연결 + 채팅방 API [x]
**목표**: DB 연결, 채팅방 생성/메시지 조회 API

작업 목록:
- [x] `src/services/supabase.js` — Supabase 클라이언트 초기화
- [x] `POST /api/chat/rooms` — chat_rooms 테이블에 방 생성
- [x] `GET /api/chat/rooms/:id/messages` — 메시지 목록 조회
- [x] `src/tests/phase2.test.js` — API 자동 테스트

**선행 조건**: .env 파일 (SUPABASE_URL, SUPABASE_SERVICE_KEY) 필요 → Phase 2 시작 전 사용자에게 요청

**검증 기준**:
- 방 생성 후 조회 성공
- 메시지 목록 빈 배열 반환

---

## Phase 3: Socket.IO 실시간 메시지 [x]
**목표**: 손님 ↔ 매니저 소켓 이벤트 완전 구현

작업 목록:
- [x] `src/socket/guestHandler.js` — guest:join, guest:send_message
- [x] `src/socket/managerHandler.js` — manager:join, manager:join_room, manager:send_reply
- [x] manager:join_room 시 해당 room 조인 처리 (핵심)
- [x] Socket.IO 재연결 시 roomId 있으면 guest:join 자동 재전송 로직
- [x] `src/tests/phase3.test.js` — 두 소켓 클라이언트로 양방향 메시지 전달 자동 검증

**검증 기준**:
- 손님 메시지 → 매니저 수신 확인
- 매니저 메시지 → 손님 수신 확인
- 재연결 후 메시지 전달 유지

---

## Phase 4: 자동응답 엔진 [x]
**목표**: FAQ 매칭 엔진 구현 + 임계값 기반 분기

작업 목록:
- [x] `src/services/faqMatcher.js` — Jaccard 유사도 계산
- [x] Supabase faqs 테이블에서 FAQ 로드
- [x] 임계값 분기: ≥0.8 자동응답 / 0.5~0.8 후보 / <0.5 escalate
- [x] guest:send_message 핸들러에 faqMatcher 연동
- [x] `src/tests/phase4.test.js` — 테스트 질문 세트로 정확도 자동 측정

**검증 기준**:
- 정확도 80% 이상
- 3가지 분기 모두 정상 동작

---

## Phase 5: 채팅 위젯 (Shadow DOM) [x]
**목표**: 순수 JS 위젯 완성 + 자동 E2E 테스트

작업 목록:
- [x] `widget/chat-widget.js` — Shadow DOM 위젯 UI
- [x] 위젯에서 script src URL 기반 서버 주소 자동 감지
- [x] 채팅창 열기/닫기, 메시지 전송/수신 UI
- [x] 매니저 연결 버튼 (escalate 시 표시)
- [x] `widget/tests/phase5.spec.js` — Playwright 자동 테스트

**검증 기준**:
- 위젯 열기 → 메시지 전송 → 자동응답 수신 전체 플로우 통과

---

## Phase 6: 관리자 페이지 (Next.js) [x]
**목표**: 관리자 대화방 목록 + 실시간 채팅 UI

작업 목록:
- [x] `admin/` Next.js 프로젝트 초기화
- [x] `app/page.tsx` — 대화방 목록 (실시간 업데이트)
- [x] `app/chat/[roomId]/page.tsx` — 실시간 채팅방
- [x] Socket.IO 클라이언트 연동 (manager:join, manager:join_room)
- [x] E2E 통합 테스트: 위젯 손님 + 관리자 페이지 양방향

**검증 기준**:
- 위젯 손님 메시지 → 관리자 페이지 실시간 수신
- 관리자 답장 → 위젯 손님 실시간 수신

---

## Phase 8: 세션 관리 재설계 + 손님 상태 UI [ ]
**목표**: 키오스크 손님 간 대화 섞임 방지 + 손님에게 방 상태 가시화 + 매니저 종료 기능

작업 목록:
- [x] 서버: `manager:close_room` / `guest:close_room` 이벤트 추가
- [x] 서버: 손님 마지막 입력 후 10분 유휴 시 자동 종료 (in-memory timer)
- [x] 서버: `guest:join` 시 closed 방은 재사용하지 않고 새 방 생성
- [x] 서버: `GET /api/chat/rooms` 기본 closed 제외 (`?include_closed=1` 옵션)
- [x] 서버: escalate 시 status='waiting', manager join 시 status='active' 브로드캐스트
- [x] 위젯: 상태 배지 (auto/waiting/active/closed) + 대화 종료 버튼
- [x] 위젯: `room:closed` 수신 시 입력 비활성화 + sessionStorage 초기화
- [x] 관리자: 채팅방 페이지에 '대화 종료' 버튼
- [x] 관리자: 목록 페이지 room:activity에 status 필드 반영 + closed 방 제거
- [x] `widget/tests/phase8.spec.js` 테스트 4개

**검증 기준**:
- 손님이 "대화 종료" → 새 방 ID 생성 확인
- 매니저가 종료 → 손님 위젯에 알림 + 입력 비활성화
- 자동 재연결(탭 새로고침)에서 closed 아니면 같은 방 유지
- 10분 유휴 타임아웃 작동

---

## Phase 7: Railway + Vercel 배포 [x]
**목표**: 프로덕션 배포 + 배포 환경 E2E 검증

작업 목록:
- [x] Railway 서버 배포 설정 (railway.toml)
- [x] CORS 프로덕션 URL 설정 (ALLOWED_ORIGINS 환경변수 기반)
- [x] Railway 배포 실행 (`railway up`)
- [x] Vercel 관리자 배포 (환경변수 NEXT_PUBLIC_API_URL 세팅)
- [x] 프로덕션 URL로 Phase 5, 6 테스트 재실행

**검증 기준**:
- 배포 URL로 전체 E2E 테스트 통과

---

## 완료 기록
- 2026-04-18: Phase 1 완료 — Express + Socket.IO 서버, /api/health, 자동 테스트 5/5 통과
- 2026-04-18: Phase 2 완료 — Supabase 연결, 채팅방 생성/메시지 조회 API, 자동 테스트 8/8 통과
- 2026-04-19: Phase 3 완료 — 손님↔매니저 Socket.IO 실시간 메시지, 자동 테스트 4/4 통과
- 2026-04-19: Phase 4 완료 — FAQ 자동응답 엔진 (Jaccard+키워드), 정확도 100%, 자동 테스트 13/13 통과
- 2026-04-19: Phase 5 완료 — Shadow DOM 채팅 위젯, Playwright E2E 테스트 5/5 통과
- 2026-04-19: Phase 6 완료 — Next.js 관리자 페이지, E2E 통합 테스트 3/3 통과
- 2026-04-19: Phase 7 완료 — Railway 서버 + Vercel 관리자 배포, 프로덕션 E2E 테스트 8/8 통과
