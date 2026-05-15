// Claude Haiku 4.5 LLM 폴백 서비스 (패턴 A)
// Jaccard 매칭이 escalate일 때만 호출되어 DB 답변만 보고 답을 시도한다.
// 답을 모르면 'NO_MATCH'로 응답해 호출자가 기존 escalate 흐름으로 fall-through하게 만든다.
//
// 안전장치:
//  - ANTHROPIC_API_KEY 미설정 시 graceful skip
//  - settings.llm_fallback_enabled !== 'true' 시 스킵
//  - 룸당 30회 / 분당 글로벌 60회 레이트 제한
//  - try/catch로 API 오류 시 항상 escalate fall-through
//  - 모든 호출은 비동기적으로 llm_fallback_logs에 로깅

const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('./supabase');
const faqMatcher = require('./faqMatcher');

const KEY = process.env.ANTHROPIC_API_KEY;
const client = KEY ? new Anthropic({ apiKey: KEY }) : null;

const MODEL = 'claude-haiku-4-5';
const MAX_OUTPUT_TOKENS = 400;
const ROOM_LIMIT = 30;          // 한 방 세션당 최대 LLM 호출
const GLOBAL_WINDOW_MS = 60_000;
const GLOBAL_LIMIT = 60;        // 분당 글로벌 최대 호출

// --- 레이트 제한 (인메모리) ---

const roomCalls = new Map();    // roomId -> count
let globalCalls = [];           // [timestamp, ...]

function checkRateLimit(roomId) {
  // 글로벌 윈도우 청소 + 검사
  const now = Date.now();
  globalCalls = globalCalls.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (globalCalls.length >= GLOBAL_LIMIT) {
    return { ok: false, reason: 'global_rate_limit' };
  }
  // 룸당 검사
  const roomCount = roomCalls.get(roomId) || 0;
  if (roomCount >= ROOM_LIMIT) {
    return { ok: false, reason: 'room_rate_limit' };
  }
  // 통과 — 카운터 증가
  globalCalls.push(now);
  roomCalls.set(roomId, roomCount + 1);
  return { ok: true };
}

// 방 종료 시 메모리 정리용 (외부에서 호출)
function clearRoomCounter(roomId) {
  roomCalls.delete(roomId);
}

// --- 프롬프트 빌더 ---

const LANG_NAME = {
  ko: '한국어',
  en: 'English',
  zh: '中文 (简体)',
  ja: '日本語',
  ru: 'Русский',
  es: 'Español',
  mn: 'Монгол хэл',
  vi: 'Tiếng Việt',
  fr: 'Français',
  de: 'Deutsch',
};

function buildSystemPrompt(answers, lang) {
  const langName = LANG_NAME[lang] || 'English';
  const faqBlock = answers
    .map((a) => `[${a.id}]\n${a.answer}`)
    .join('\n\n');

  return [
    `You are the FAQ chatbot for Yakorea Hostel in Seoul, Korea.`,
    ``,
    `STRICT RULES:`,
    `1. Answer ONLY using information from the FAQ list below. Do NOT use outside knowledge or make up details.`,
    `2. If the guest's question cannot be answered from the FAQs, respond with EXACTLY: NO_MATCH`,
    `   (single word, no other text). The system will then connect them to a human.`,
    `3. If the question CAN be answered, write a friendly natural reply in ${langName}.`,
    `4. Keep replies concise: 2 to 4 sentences. No bullet points unless listing items.`,
    `5. Never reveal you are an AI. Never mention "FAQ" or "the list". Speak as the hostel chatbot.`,
    `6. If multiple FAQs are relevant, you may combine info from them.`,
    `7. Preserve any specific values exactly as written (times, prices, phone numbers, addresses).`,
    ``,
    `--- FAQ LIST (each entry: [intent_id] then the answer text) ---`,
    ``,
    faqBlock,
    ``,
    `--- END OF FAQ LIST ---`,
    ``,
    `Now answer the guest's question. Reply in ${langName}, or output NO_MATCH if not covered.`,
  ].join('\n');
}

// --- 로깅 ---

async function logToSupabase(row) {
  try {
    await supabase.from('llm_fallback_logs').insert(row);
  } catch (e) {
    console.error('[LLM] 로그 저장 실패:', e.message);
  }
}

// --- 토글 플래그 ---

async function isEnabled() {
  if (!client) return false;
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'llm_fallback_enabled')
      .maybeSingle();
    return data?.value === 'true';
  } catch (e) {
    console.error('[LLM] 플래그 조회 실패:', e.message);
    return false;
  }
}

// --- 메인 호출 ---

async function answer({ question, lang = 'ko', roomId = null }) {
  if (!client) return { ok: false, reason: 'no_api_key' };

  const rl = checkRateLimit(roomId);
  if (!rl.ok) {
    console.warn(`[LLM] 레이트 제한 — ${rl.reason} (room=${roomId})`);
    return { ok: false, reason: rl.reason };
  }

  let answers;
  try {
    answers = await faqMatcher.getAllAnswersForLang(lang);
  } catch (e) {
    return { ok: false, reason: 'faq_load_error', error: e.message };
  }
  if (!answers || answers.length === 0) {
    return { ok: false, reason: 'no_faqs' };
  }

  const systemPrompt = buildSystemPrompt(answers, lang);
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
      messages: [{ role: 'user', content: question }],
    });

    const latencyMs = Date.now() - t0;
    const text = (resp.content?.[0]?.text || '').trim();
    const matched = !!text && !/^NO_MATCH\b/i.test(text);

    // 비동기 로깅 — 응답 흐름은 막지 않음
    logToSupabase({
      room_id: roomId,
      question,
      language: lang,
      answer: matched ? text : null,
      matched,
      input_tokens: resp.usage?.input_tokens ?? null,
      output_tokens: resp.usage?.output_tokens ?? null,
      cache_read_tokens: resp.usage?.cache_read_input_tokens ?? null,
      cache_creation_tokens: resp.usage?.cache_creation_input_tokens ?? null,
      latency_ms: latencyMs,
    });

    if (matched) {
      return { ok: true, answer: text, latencyMs };
    } else {
      return { ok: false, reason: 'no_match' };
    }
  } catch (err) {
    const latencyMs = Date.now() - t0;
    console.error('[LLM] API 오류:', err.message);
    logToSupabase({
      room_id: roomId,
      question,
      language: lang,
      matched: false,
      error: err.message,
      latency_ms: latencyMs,
    });
    return { ok: false, reason: 'api_error', error: err.message };
  }
}

module.exports = { answer, isEnabled, clearRoomCounter };
