-- ============================================================
-- 야코리아 채팅 시스템 V2 — Supabase 데이터베이스 스키마
-- ============================================================
-- 이 SQL을 Supabase 대시보드 → SQL Editor에서 실행하세요.
-- 이미 테이블이 있는 경우 IF NOT EXISTS 덕분에 중복 생성되지 않습니다.
-- ============================================================

-- UUID 자동 생성을 위한 확장 (보통 이미 활성화되어 있음)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== 테이블 생성 ====================

-- ---------- 1. 대화방 (chat_rooms) ----------
-- 손님 1명당 1개의 대화방이 생성됩니다.
-- 손님은 브라우저 세션마다 고유한 session_id를 가집니다.
CREATE TABLE IF NOT EXISTS chat_rooms (
  id                   UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  guest_session_id     VARCHAR(255) NOT NULL,          -- 손님 세션 ID (브라우저에서 생성)
  language             VARCHAR(10)  DEFAULT 'ko',      -- 손님 선택 언어 (ko, en, zh, ja)
  status               VARCHAR(50)  DEFAULT 'active',  -- active | waiting_manager | closed
  is_manager_connected BOOLEAN      DEFAULT FALSE,     -- 매니저가 수동으로 연결했는지 여부
  has_unread           BOOLEAN      DEFAULT FALSE,     -- 매니저가 아직 읽지 않은 메시지 존재
  last_message_at      TIMESTAMPTZ,                    -- 가장 최근 메시지 시간 (목록 정렬용)
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

-- 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_rooms_session ON chat_rooms(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_status  ON chat_rooms(status);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_unread  ON chat_rooms(has_unread);

-- ---------- 2. 메시지 (messages) ----------
-- 손님, 매니저, 시스템(자동응답) 모두 이 테이블에 저장됩니다.
CREATE TABLE IF NOT EXISTS messages (
  id                UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  chat_room_id      UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_type       VARCHAR(20) NOT NULL,          -- guest | manager | system
  content           TEXT        NOT NULL,          -- 메시지 본문
  is_auto_reply     BOOLEAN     DEFAULT FALSE,     -- 자동응답 엔진이 생성한 메시지인지
  matched_intent_id VARCHAR(100),                  -- 자동응답 시 매칭된 FAQ 의도 ID
  confidence_score  FLOAT,                         -- 자동응답 신뢰도 (0.0 ~ 1.0)
  is_read           BOOLEAN     DEFAULT FALSE,     -- 매니저가 읽었는지 여부
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room    ON messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- ---------- 3. FAQ 의도 (intents) ----------
-- 하나의 의도 = 하나의 FAQ 주제 (예: 체크인 시간, 와이파이 정보)
CREATE TABLE IF NOT EXISTS intents (
  id            VARCHAR(100) PRIMARY KEY,        -- 의도 식별자 (예: check_in_time)
  category      VARCHAR(100) DEFAULT '일반',     -- 카테고리 (시간안내, 시설안내 등)
  is_active     BOOLEAN      DEFAULT TRUE,       -- 비활성화 시 자동응답에서 제외
  display_order INT          DEFAULT 0,          -- 관리자 페이지 표시 순서
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ---------- 4. FAQ 유사 질문 (intent_questions) ----------
-- 하나의 의도에 여러 언어, 여러 표현의 질문을 등록합니다.
-- 자동응답 매칭의 핵심 데이터입니다.
CREATE TABLE IF NOT EXISTS intent_questions (
  id            UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  intent_id     VARCHAR(100) NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
  language      VARCHAR(10)  DEFAULT 'ko',   -- 질문 언어
  question_text TEXT         NOT NULL,       -- 유사 질문 표현
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_questions_intent ON intent_questions(intent_id);

-- ---------- 5. FAQ 답변 (intent_answers) ----------
-- 각 의도별, 언어별 답변 템플릿입니다.
-- {{변수명}} 형태로 운영 설정값을 동적으로 삽입할 수 있습니다.
CREATE TABLE IF NOT EXISTS intent_answers (
  id              UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  intent_id       VARCHAR(100) NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
  language        VARCHAR(10)  DEFAULT 'ko',
  answer_template TEXT         NOT NULL,   -- 예: "체크인은 {{check_in_time}}부터입니다."
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_answers_intent ON intent_answers(intent_id);

-- ---------- 6. 운영 설정 (settings) ----------
-- FAQ 답변 템플릿에서 {{변수}}로 참조되는 실제 운영 정보입니다.
-- 관리자 페이지에서 직접 수정할 수 있습니다.
CREATE TABLE IF NOT EXISTS settings (
  key       VARCHAR(100) PRIMARY KEY,
  value     TEXT         NOT NULL,
  label     VARCHAR(200),                    -- 관리자 페이지 표시용 이름
  category  VARCHAR(50)  DEFAULT 'general',  -- time | contact | facility | message | auto_reply
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 7. 자동응답 실패 질문 기록 (unmatched_questions) ----------
-- 자동응답이 안 된 질문을 기록하여 나중에 FAQ로 추가할 수 있게 합니다.
CREATE TABLE IF NOT EXISTS unmatched_questions (
  id                 UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_text      TEXT         NOT NULL,
  language           VARCHAR(10)  DEFAULT 'ko',
  status             VARCHAR(50)  DEFAULT 'pending',  -- pending | resolved | added_to_faq
  resolved_intent_id VARCHAR(100),                    -- FAQ로 추가됐다면 해당 의도 ID
  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unmatched_status ON unmatched_questions(status);


-- ==================== 초기 데이터 삽입 ====================

-- --- 운영 설정 기본값 ---
INSERT INTO settings (key, value, label, category) VALUES
  ('check_in_time',             '15:00',           '체크인 시간',             'time'),
  ('check_out_time',            '11:00',           '체크아웃 시간',            'time'),
  ('front_desk_hours',          '09:00~22:00',     '프런트 운영시간',           'time'),
  ('breakfast_time',            '07:30~09:30',     '조식 시간',               'time'),
  ('contact_phone',             '010-0000-0000',   '연락처',                  'contact'),
  ('wifi_ssid',                 'YAKOREA_GUEST',   '와이파이 이름',             'facility'),
  ('wifi_password',             'YAKOREA2026',     '와이파이 비밀번호',          'facility'),
  ('welcome_msg',               '안녕하세요! 야코리아입니다. 무엇을 도와드릴까요?', '환영 메시지', 'message'),
  ('no_match_msg_ko',           '자동응답으로 답변하기 어려운 질문입니다. "매니저와 대화하기" 버튼을 눌러주세요.', '자동응답 실패 메시지(한국어)', 'message'),
  ('auto_reply_high_threshold', '0.8',             '자동응답 확정 임계값',       'auto_reply'),
  ('auto_reply_low_threshold',  '0.5',             '자동응답 후보 표시 임계값',   'auto_reply')
ON CONFLICT (key) DO NOTHING;

-- --- FAQ 의도 등록 ---
INSERT INTO intents (id, category, is_active, display_order) VALUES
  ('check_in_time',    '시간안내', TRUE, 1),
  ('check_out_time',   '시간안내', TRUE, 2),
  ('wifi_info',        '시설안내', TRUE, 3),
  ('breakfast_info',   '시간안내', TRUE, 4),
  ('front_desk_hours', '시간안내', TRUE, 5),
  ('contact_info',     '연락처',   TRUE, 6)
ON CONFLICT (id) DO NOTHING;

-- --- FAQ 유사 질문 (한국어/영어/중국어/일본어) ---
INSERT INTO intent_questions (intent_id, language, question_text) VALUES
  -- 체크인 시간
  ('check_in_time', 'ko', '체크인 언제예요?'),
  ('check_in_time', 'ko', '방에 몇 시부터 들어갈 수 있어요?'),
  ('check_in_time', 'ko', '체크인 시간 알려주세요'),
  ('check_in_time', 'ko', '몇시부터 들어가도 돼요?'),
  ('check_in_time', 'en', 'What time is check-in?'),
  ('check_in_time', 'en', 'When can I check in?'),
  ('check_in_time', 'en', 'check in time?'),
  ('check_in_time', 'zh', '几点可以入住？'),
  ('check_in_time', 'zh', '入住时间是几点？'),
  ('check_in_time', 'ja', '何時からチェックインできますか？'),
  ('check_in_time', 'ja', 'チェックインは何時ですか？'),
  -- 체크아웃 시간
  ('check_out_time', 'ko', '체크아웃 언제예요?'),
  ('check_out_time', 'ko', '몇 시까지 있을 수 있어요?'),
  ('check_out_time', 'ko', '체크아웃 시간 알려주세요'),
  ('check_out_time', 'en', 'What time is check-out?'),
  ('check_out_time', 'en', 'When do I need to check out?'),
  ('check_out_time', 'zh', '退房时间是几点？'),
  ('check_out_time', 'ja', 'チェックアウトは何時ですか？'),
  -- 와이파이
  ('wifi_info', 'ko', '와이파이 비밀번호 뭐예요?'),
  ('wifi_info', 'ko', '와이파이 알려주세요'),
  ('wifi_info', 'ko', '인터넷 비번이 뭐예요?'),
  ('wifi_info', 'en', 'What is the WiFi password?'),
  ('wifi_info', 'en', 'WiFi password please'),
  ('wifi_info', 'zh', 'WiFi密码是什么？'),
  ('wifi_info', 'ja', 'WiFiのパスワードを教えてください'),
  -- 조식
  ('breakfast_info', 'ko', '조식 언제예요?'),
  ('breakfast_info', 'ko', '아침 식사 시간 알려주세요'),
  ('breakfast_info', 'en', 'What time is breakfast?'),
  ('breakfast_info', 'zh', '早餐时间是几点？'),
  ('breakfast_info', 'ja', '朝食は何時からですか？'),
  -- 프런트 운영시간
  ('front_desk_hours', 'ko', '프런트 운영시간이 어떻게 돼요?'),
  ('front_desk_hours', 'ko', '프런트 데스크 몇 시까지 열어요?'),
  ('front_desk_hours', 'en', 'What are the front desk hours?'),
  ('front_desk_hours', 'zh', '前台营业时间是几点？'),
  ('front_desk_hours', 'ja', 'フロントは何時まで開いていますか？'),
  -- 연락처
  ('contact_info', 'ko', '전화번호 알려주세요'),
  ('contact_info', 'ko', '연락처가 어떻게 돼요?'),
  ('contact_info', 'en', 'What is your phone number?'),
  ('contact_info', 'zh', '电话号码是多少？'),
  ('contact_info', 'ja', '電話番号を教えてください')
ON CONFLICT DO NOTHING;

-- --- FAQ 답변 템플릿 ({{변수}} 사용) ---
INSERT INTO intent_answers (intent_id, language, answer_template) VALUES
  ('check_in_time',    'ko', '체크인은 {{check_in_time}}부터 가능합니다.'),
  ('check_in_time',    'en', 'Check-in is available from {{check_in_time}}.'),
  ('check_in_time',    'zh', '入住时间从{{check_in_time}}起。'),
  ('check_in_time',    'ja', 'チェックインは{{check_in_time}}からです。'),
  ('check_out_time',   'ko', '체크아웃은 {{check_out_time}}까지입니다.'),
  ('check_out_time',   'en', 'Check-out is by {{check_out_time}}.'),
  ('check_out_time',   'zh', '退房时间为{{check_out_time}}前。'),
  ('check_out_time',   'ja', 'チェックアウトは{{check_out_time}}までです。'),
  ('wifi_info',        'ko', '와이파이 이름: {{wifi_ssid}} / 비밀번호: {{wifi_password}}'),
  ('wifi_info',        'en', 'WiFi Name: {{wifi_ssid}} / Password: {{wifi_password}}'),
  ('wifi_info',        'zh', 'WiFi名称：{{wifi_ssid}} / 密码：{{wifi_password}}'),
  ('wifi_info',        'ja', 'WiFi名：{{wifi_ssid}} / パスワード：{{wifi_password}}'),
  ('breakfast_info',   'ko', '조식 시간은 {{breakfast_time}}입니다.'),
  ('breakfast_info',   'en', 'Breakfast is served from {{breakfast_time}}.'),
  ('breakfast_info',   'zh', '早餐时间为{{breakfast_time}}。'),
  ('breakfast_info',   'ja', '朝食は{{breakfast_time}}です。'),
  ('front_desk_hours', 'ko', '프런트 운영시간은 {{front_desk_hours}}입니다.'),
  ('front_desk_hours', 'en', 'Front desk hours: {{front_desk_hours}}.'),
  ('front_desk_hours', 'zh', '前台营业时间：{{front_desk_hours}}。'),
  ('front_desk_hours', 'ja', 'フロントの営業時間は{{front_desk_hours}}です。'),
  ('contact_info',     'ko', '연락처: {{contact_phone}}'),
  ('contact_info',     'en', 'Contact: {{contact_phone}}'),
  ('contact_info',     'zh', '联系电话：{{contact_phone}}'),
  ('contact_info',     'ja', '連絡先：{{contact_phone}}')
ON CONFLICT DO NOTHING;
