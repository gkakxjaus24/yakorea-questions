-- LLM 폴백 로그 테이블
-- 비용·품질·지연 모니터링 및 자동학습용 데이터 수집
CREATE TABLE IF NOT EXISTS llm_fallback_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid REFERENCES chat_rooms(id) ON DELETE SET NULL,
  question            text NOT NULL,
  language            varchar(8) NOT NULL,
  answer              text,
  matched             boolean NOT NULL,           -- true=답변, false=NO_MATCH
  input_tokens        int,
  output_tokens       int,
  cache_read_tokens   int,
  cache_creation_tokens int,
  latency_ms          int,
  error               text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS llm_fallback_logs_created_at_idx
  ON llm_fallback_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS llm_fallback_logs_matched_idx
  ON llm_fallback_logs (matched);

CREATE INDEX IF NOT EXISTS llm_fallback_logs_language_idx
  ON llm_fallback_logs (language);
