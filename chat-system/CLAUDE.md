# Ya Korea Hostel — Chat System (AI 행동 지침)

## 프로젝트 핵심
호스텔 키오스크/웹에 설치되는 채팅 위젯. FAQ 자동응답 우선, 실패 시 매니저 연결.
상세 내용 → @PRD.md | 아키텍처 → @architecture.md | 진행 상황 → @tasks.md

## 기술 스택 (이 외 라이브러리 추가 금지)
- Server: Node.js + Express + Socket.IO
- DB: Supabase (스키마 확정, 변경 금지)
- Widget: 순수 JS + Shadow DOM (프레임워크 없음)
- Admin: Next.js → Vercel
- Server Deploy: Railway

## 작업 규칙 (필수)
1. **Plan Mode First** — 코드 작성 전 반드시 탐색 후 구현 계획 + 미해결 질문 리스트 제시
2. **단일 Task** — tasks.md의 현재 Phase 하나만 구현, 완료 후 사용자 승인 후 다음 단계
3. **테스트 필수** — 각 Phase 완료 시 자동 테스트 스크립트 실행, 통과 후에만 git commit
4. **간결한 응답** — 계획/답변은 핵심만, 불필요한 설명 생략
5. **미해결 질문** — 계획 끝에 항상 "확인 필요 사항" 리스트 출력

## 반드시 지킬 사항
- 요청 없이 즉시 코딩 시작 금지
- 한 세션에 여러 Phase 동시 구현 금지
- 테스트 실패 시 다음 Phase 진행 금지
- .env 파일 절대 커밋 금지

## 알려진 핵심 이슈 (반드시 반영)
1. 손님/매니저 소켓은 반드시 같은 Socket.IO room에 있어야 함
   → manager:join_room 이벤트로 매니저 명시적 조인 필수
2. 위젯은 script src URL에서 서버 주소 자동 감지
3. Socket.IO 재연결 시 roomId 있으면 guest:join 자동 재전송

## 작업 완료 시 루틴
1. tasks.md 해당 Phase [x] 표시
2. git commit
3. 다음 Phase 진행 여부 사용자에게 질문
