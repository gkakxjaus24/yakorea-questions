// 자동 번역 서비스 (Claude Haiku 4.5)
//
// Forward (손님→매니저): 손님이 비-{ko,en,zh}로 보내면 영어로 번역
// Backward (매니저→손님): 매니저가 중국어로 답하면 손님 언어로 번역
//
// 안전장치:
//  - ANTHROPIC_API_KEY 미설정 시 graceful skip
//  - settings.translation_enabled !== 'true' 시 스킵
//  - 룸당 30회 / 분당 글로벌 60회 레이트 제한
//  - 인메모리 LRU 캐시 (200개)
//  - try/catch로 API 오류 시 호출자가 원문 그대로 사용
//  - 모든 호출은 비동기적으로 translation_logs에 로깅

const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('./supabase');

const KEY = process.env.ANTHROPIC_API_KEY;
const client = KEY ? new Anthropic({ apiKey: KEY }) : null;

const MODEL = 'claude-haiku-4-5';
const MAX_OUTPUT_TOKENS = 200;
const ROOM_LIMIT = 30;
const GLOBAL_WINDOW_MS = 60_000;
const GLOBAL_LIMIT = 60;
const CACHE_MAX = 200;

// --- 레이트 제한 ---

const roomCalls = new Map();
let globalCalls = [];

function checkRateLimit(roomId) {
  const now = Date.now();
  globalCalls = globalCalls.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (globalCalls.length >= GLOBAL_LIMIT) {
    return { ok: false, reason: 'global_rate_limit' };
  }
  const roomCount = roomCalls.get(roomId) || 0;
  if (roomCount >= ROOM_LIMIT) {
    return { ok: false, reason: 'room_rate_limit' };
  }
  globalCalls.push(now);
  roomCalls.set(roomId, roomCount + 1);
  return { ok: true };
}

function clearRoomCounter(roomId) {
  roomCalls.delete(roomId);
}

// --- LRU 캐시 (Map은 삽입 순서 보존이라 그대로 LRU로 활용) ---

const cache = new Map();
function cacheKey(sourceLang, targetLang, text) {
  return `${sourceLang}::${targetLang}::${text}`;
}
function cacheGet(key) {
  if (!cache.has(key)) return null;
  const v = cache.get(key);
  cache.delete(key);
  cache.set(key, v); // LRU 갱신
  return v;
}
function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, value);
}

// --- 언어 코드 → 영어 이름 ---

const LANG_NAME = {
  ko: 'Korean',
  en: 'English',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  ru: 'Russian',
  es: 'Spanish',
  mn: 'Mongolian',
};

// --- 시스템 프롬프트 ---

function buildSystemPrompt(sourceLang, targetLang) {
  const src = LANG_NAME[sourceLang] || sourceLang;
  const tgt = LANG_NAME[targetLang] || targetLang;
  return [
    `You are a professional translator for the Yakorea Hostel chat system in Seoul, Korea.`,
    ``,
    `STRICT RULES:`,
    `1. Translate the user's message from ${src} to ${tgt}.`,
    `2. Output ONLY the translation. No quotes, no commentary, no labels.`,
    `3. Preserve numbers, times, prices, phone numbers, room labels (B1, 201, 202...) exactly.`,
    `4. Preserve proper nouns (Yakorea, Seoul) exactly.`,
    `5. Keep the tone friendly and natural in ${tgt}.`,
    `6. If the message is already in ${tgt}, output it unchanged.`,
  ].join('\n');
}

// --- 로깅 ---

async function logToSupabase(row) {
  try {
    await supabase.from('translation_logs').insert(row);
  } catch (e) {
    console.error('[Translate] 로그 저장 실패:', e.message);
  }
}

// --- 토글 플래그 ---

async function isEnabled() {
  if (!client) return false;
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'translation_enabled')
      .maybeSingle();
    return data?.value === 'true';
  } catch (e) {
    console.error('[Translate] 플래그 조회 실패:', e.message);
    return false;
  }
}

// --- 메인 호출 ---

async function translate({ text, sourceLang, targetLang, roomId = null, direction = 'forward' }) {
  if (!client) return { ok: false, reason: 'no_api_key' };
  if (!text || !text.trim()) return { ok: false, reason: 'empty_text' };
  if (sourceLang === targetLang) return { ok: true, translated: text, latencyMs: 0, cacheHit: true };

  // 캐시 확인
  const ck = cacheKey(sourceLang, targetLang, text);
  const cached = cacheGet(ck);
  if (cached) {
    // 캐시 히트도 비용 모니터링용으로 가볍게 로깅
    logToSupabase({
      room_id: roomId,
      direction,
      source_lang: sourceLang,
      target_lang: targetLang,
      source_text: text,
      translated_text: cached,
      cache_hit: true,
      latency_ms: 0,
    });
    return { ok: true, translated: cached, latencyMs: 0, cacheHit: true };
  }

  const rl = checkRateLimit(roomId);
  if (!rl.ok) {
    console.warn(`[Translate] 레이트 제한 — ${rl.reason} (room=${roomId})`);
    return { ok: false, reason: rl.reason };
  }

  const systemPrompt = buildSystemPrompt(sourceLang, targetLang);
  const t0 = Date.now();

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: text }],
    });

    const latencyMs = Date.now() - t0;
    const translated = (resp.content?.[0]?.text || '').trim();

    if (!translated) {
      logToSupabase({
        room_id: roomId,
        direction,
        source_lang: sourceLang,
        target_lang: targetLang,
        source_text: text,
        translated_text: null,
        cache_hit: false,
        input_tokens: resp.usage?.input_tokens ?? null,
        output_tokens: resp.usage?.output_tokens ?? null,
        cache_read_tokens: resp.usage?.cache_read_input_tokens ?? null,
        cache_creation_tokens: resp.usage?.cache_creation_input_tokens ?? null,
        latency_ms: latencyMs,
        error: 'empty_response',
      });
      return { ok: false, reason: 'empty_response' };
    }

    cacheSet(ck, translated);

    logToSupabase({
      room_id: roomId,
      direction,
      source_lang: sourceLang,
      target_lang: targetLang,
      source_text: text,
      translated_text: translated,
      cache_hit: false,
      input_tokens: resp.usage?.input_tokens ?? null,
      output_tokens: resp.usage?.output_tokens ?? null,
      cache_read_tokens: resp.usage?.cache_read_input_tokens ?? null,
      cache_creation_tokens: resp.usage?.cache_creation_input_tokens ?? null,
      latency_ms: latencyMs,
    });

    return { ok: true, translated, latencyMs, cacheHit: false };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    console.error('[Translate] API 오류:', err.message);
    logToSupabase({
      room_id: roomId,
      direction,
      source_lang: sourceLang,
      target_lang: targetLang,
      source_text: text,
      translated_text: null,
      cache_hit: false,
      latency_ms: latencyMs,
      error: err.message,
    });
    return { ok: false, reason: 'api_error', error: err.message };
  }
}

module.exports = { translate, isEnabled, clearRoomCounter };
