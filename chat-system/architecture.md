# Architecture — Ya Korea Hostel Chat System

## 시스템 구성도

```
[손님 브라우저]                [매니저 브라우저]
  위젯 (Shadow DOM)              Next.js Admin (Vercel)
       |                               |
       |---- Socket.IO ----+---- Socket.IO ----|
                           |
                    [Railway Server]
                  Node.js + Express + Socket.IO
                           |
                      [Supabase]
                  chat_rooms / messages / faqs
```

## 폴더 구조
```
project_chat_system/
├── server/                  # Node.js + Express + Socket.IO
│   ├── src/
│   │   ├── index.js         # 서버 진입점
│   │   ├── socket/
│   │   │   ├── guestHandler.js   # guest:* 이벤트 처리
│   │   │   └── managerHandler.js # manager:* 이벤트 처리
│   │   ├── routes/
│   │   │   ├── health.js    # GET /api/health
│   │   │   └── chat.js      # POST /api/chat/rooms, GET /api/chat/rooms/:id/messages
│   │   ├── services/
│   │   │   ├── supabase.js  # Supabase 클라이언트
│   │   │   └── faqMatcher.js # Jaccard 유사도 엔진
│   │   └── tests/           # 각 Phase 자동 테스트 스크립트
│   ├── .env                 # (git 제외)
│   └── package.json
│
├── widget/                  # 순수 JS Shadow DOM 위젯
│   ├── chat-widget.js       # 단일 번들 파일
│   └── tests/               # Playwright E2E 테스트
│
├── admin/                   # Next.js 관리자 페이지
│   ├── app/
│   │   ├── page.tsx         # 대화방 목록
│   │   └── chat/[roomId]/
│   │       └── page.tsx     # 실시간 채팅방
│   ├── .env.local           # (git 제외)
│   └── package.json
│
├── CLAUDE.md
├── PRD.md
├── architecture.md
├── tasks.md
└── decisions.md
```

## Supabase DB 스키마
```sql
-- 채팅방
chat_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id    text NOT NULL,       -- 손님 식별자 (소켓 ID or 로컬 UUID)
  status      text DEFAULT 'auto', -- 'auto' | 'waiting' | 'active' | 'closed'
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
)

-- 메시지
messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid REFERENCES chat_rooms(id),
  sender_type text NOT NULL,       -- 'guest' | 'manager' | 'auto'
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
)

-- FAQ (자동응답용)
faqs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question    text NOT NULL,
  answer      text NOT NULL,
  keywords    text[],              -- 매칭 보조 키워드
  is_active   boolean DEFAULT true
)
```

## Socket.IO 이벤트 명세

### 손님 → 서버
| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `guest:join` | `{ roomId?, guestId }` | 채팅방 입장 (roomId 없으면 신규 생성) |
| `guest:send_message` | `{ roomId, content }` | 메시지 전송 |

### 서버 → 손님
| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `room:created` | `{ roomId }` | 방 생성 완료 |
| `auto:response` | `{ content, confidence }` | 자동응답 |
| `auto:candidates` | `{ candidates[] }` | 후보 답변 제시 |
| `auto:escalate` | `{}` | 매니저 연결 필요 |
| `manager:message` | `{ content, timestamp }` | 매니저 메시지 수신 |

### 매니저 → 서버
| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `manager:join` | `{ managerId }` | 매니저 소켓 등록 |
| `manager:join_room` | `{ roomId }` | 특정 채팅방 입장 (핵심!) |
| `manager:send_reply` | `{ roomId, content }` | 손님에게 답장 |

### 서버 → 매니저
| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `room:list` | `{ rooms[] }` | 대화방 목록 |
| `room:new_request` | `{ roomId, guestId }` | 새 연결 요청 알림 |
| `guest:message` | `{ content, timestamp }` | 손님 메시지 수신 |

## 자동응답 엔진 (Jaccard 유사도)
```
입력 질문 → 토큰화 → Jaccard 유사도 계산 (FAQ 전체와 비교)
→ max 유사도 ≥ 0.8 → 자동응답 전송
→ max 유사도 0.5~0.8 → 후보 목록 반환
→ max 유사도 < 0.5 → escalate (매니저 연결 유도)
```

## 배포 URL
| 환경 | 서버 | 관리자 |
|------|------|--------|
| 로컬 | http://localhost:3001 | http://localhost:3000 |
| 프로덕션 | https://projectclaude-production-5351.up.railway.app | https://yakorea-chat-admin.vercel.app |

## GitHub 레포
- `gkakxjaus24/Project_Claude` (모노레포)
- Railway Root: `chat-system/server`
- Vercel Root: `chat-system/admin`
- Branch: `master`

## 환경변수 (서버 — server/.env 참조, 절대 커밋 금지)
```
NODE_ENV / PORT / SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET / MANAGER_EMAIL / MANAGER_PASSWORD / ALLOWED_ORIGINS
```

## 환경변수 (관리자 Next.js — admin/.env.local)
```
NEXT_PUBLIC_API_URL=https://projectclaude-production-5351.up.railway.app
```

## 위젯 삽입 코드
```html
<script src="https://projectclaude-production-5351.up.railway.app/widget/chat-widget.js"></script>
```
