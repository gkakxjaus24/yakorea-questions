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

## Phase 3: Socket.IO 실시간 메시지 [ ]
**목표**: 손님 ↔ 매니저 소켓 이벤트 완전 구현

작업 목록:
- [ ] `src/socket/guestHandler.js` — guest:join, guest:send_message
- [ ] `src/socket/managerHandler.js` — manager:join, manager:join_room, manager:send_reply
- [ ] manager:join_room 시 해당 room 조인 처리 (핵심)
- [ ] Socket.IO 재연결 시 roomId 있으면 guest:join 자동 재전송 로직
- [ ] `src/tests/phase3.test.js` — 두 소켓 클라이언트로 양방향 메시지 전달 자동 검증

**검증 기준**:
- 손님 메시지 → 매니저 수신 확인
- 매니저 메시지 → 손님 수신 확인
- 재연결 후 메시지 전달 유지

---

## Phase 4: 자동응답 엔진 [ ]
**목표**: FAQ 매칭 엔진 구현 + 임계값 기반 분기

작업 목록:
- [ ] `src/services/faqMatcher.js` — Jaccard 유사도 계산
- [ ] Supabase faqs 테이블에서 FAQ 로드
- [ ] 임계값 분기: ≥0.8 자동응답 / 0.5~0.8 후보 / <0.5 escalate
- [ ] guest:send_message 핸들러에 faqMatcher 연동
- [ ] `src/tests/phase4.test.js` — 테스트 질문 세트로 정확도 자동 측정

**검증 기준**:
- 정확도 80% 이상
- 3가지 분기 모두 정상 동작

---

## Phase 5: 채팅 위젯 (Shadow DOM) [ ]
**목표**: 순수 JS 위젯 완성 + 자동 E2E 테스트

작업 목록:
- [ ] `widget/chat-widget.js` — Shadow DOM 위젯 UI
- [ ] 위젯에서 script src URL 기반 서버 주소 자동 감지
- [ ] 채팅창 열기/닫기, 메시지 전송/수신 UI
- [ ] 매니저 연결 버튼 (escalate 시 표시)
- [ ] `widget/tests/phase5.spec.js` — Playwright 자동 테스트

**검증 기준**:
- 위젯 열기 → 메시지 전송 → 자동응답 수신 전체 플로우 통과

---

## Phase 6: 관리자 페이지 (Next.js) [ ]
**목표**: 관리자 대화방 목록 + 실시간 채팅 UI

작업 목록:
- [ ] `admin/` Next.js 프로젝트 초기화
- [ ] `app/page.tsx` — 대화방 목록 (실시간 업데이트)
- [ ] `app/chat/[roomId]/page.tsx` — 실시간 채팅방
- [ ] Socket.IO 클라이언트 연동 (manager:join, manager:join_room)
- [ ] E2E 통합 테스트: 위젯 손님 + 관리자 페이지 양방향

**검증 기준**:
- 위젯 손님 메시지 → 관리자 페이지 실시간 수신
- 관리자 답장 → 위젯 손님 실시간 수신

---

## Phase 7: Railway + Vercel 배포 [ ]
**목표**: 프로덕션 배포 + 배포 환경 E2E 검증

작업 목록:
- [ ] Railway 서버 배포 설정 (railway.toml)
- [ ] Vercel 관리자 배포 설정 (환경변수 세팅)
- [ ] CORS 프로덕션 URL 설정
- [ ] 프로덕션 URL로 Phase 5, 6 테스트 재실행

**검증 기준**:
- 배포 URL로 전체 E2E 테스트 통과

---

## 완료 기록
- 2026-04-18: Phase 1 완료 — Express + Socket.IO 서버, /api/health, 자동 테스트 5/5 통과
- 2026-04-18: Phase 2 완료 — Supabase 연결, 채팅방 생성/메시지 조회 API, 자동 테스트 8/8 통과
