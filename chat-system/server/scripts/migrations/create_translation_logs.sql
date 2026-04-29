-- 양방향 자동 번역 기능용 마이그레이션
-- 1) messages 테이블에 번역문/원본 언어 컬럼 추가
-- 2) chat_rooms 테이블에 손님 언어 컬럼 추가 (매니저 답변 번역 시 타겟 언어 결정용)
-- 3) translation_logs 테이블 신규 (비용·지연 모니터링)
-- 4) settings 테이블에 translation_enabled 플래그 (기본 false)

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS content_translated text,
  ADD COLUMN IF NOT EXISTS original_lang varchar(8);

ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS guest_lang varchar(8);

CREATE TABLE IF NOT EXISTS translation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES chat_rooms(id) ON DELETE SET NULL,
  direction varchar(16) NOT NULL,        -- 'forward' (guest→manager) or 'backward' (manager→guest)
  source_lang varchar(8) NOT NULL,
  target_lang varchar(8) NOT NULL,
  source_text text NOT NULL,
  translated_text text,
  cache_hit boolean DEFAULT false,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_creation_tokens int,
  latency_ms int,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translation_logs_created_at ON translation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translation_logs_direction ON translation_logs(direction);

INSERT INTO settings (key, value)
  VALUES ('translation_enabled', 'false')
  ON CONFLICT (key) DO NOTHING;
