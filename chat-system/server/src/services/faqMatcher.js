const supabase = require('./supabase');

// --- 토크나이저 & 유사도 ---

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0)
  );
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}


// --- 5분 캐시 ---

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadIntents() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;

  const [{ data: questions, error: qErr }, { data: answers, error: aErr }, { data: settings, error: sErr }] =
    await Promise.all([
      supabase.from('intent_questions').select('intent_id, question_text').eq('language', 'ko'),
      supabase.from('intent_answers').select('intent_id, answer_template').eq('language', 'ko'),
      supabase.from('settings').select('key, value'),
    ]);

  if (qErr || aErr || sErr) throw qErr || aErr || sErr;

  // settings → { key: value } 맵
  const settingsMap = {};
  (settings || []).forEach((s) => (settingsMap[s.key] = s.value));

  // intent별 질문 그룹화
  const map = {};
  (questions || []).forEach(({ intent_id, question_text }) => {
    if (!map[intent_id]) map[intent_id] = { questions: [], answer: null };
    map[intent_id].questions.push(question_text);
  });

  // intent별 답변 + {{변수}} 치환
  (answers || []).forEach(({ intent_id, answer_template }) => {
    if (!map[intent_id]) return;
    const filled = answer_template.replace(/\{\{(\w+)\}\}/g, (_, key) => settingsMap[key] ?? `{{${key}}}`);
    map[intent_id].answer = filled;
  });

  // 답변 없는 intent 제외 후 배열로
  _cache = Object.entries(map)
    .filter(([, v]) => v.answer && v.questions.length > 0)
    .map(([id, v]) => ({
      id,
      answer: v.answer,
      // 질문별 토큰셋 미리 계산
      variants: v.questions.map((q) => ({ text: q, tokens: tokenize(q) })),
    }));

  _cacheAt = Date.now();
  console.log(`[FAQ] ${_cache.length}개 intent 로드 완료 (질문 변형 총 ${(questions || []).length}개)`);
  return _cache;
}

// 캐시 무효화 (설정 변경 시 외부 호출용)
function invalidateCache() {
  _cache = null;
}

// --- 에스컬레이션 키워드 선탐지 ---

function isEscalationRequest(text) {
  const t = text.replace(/\s+/g, '').toLowerCase();

  // 단독으로 에스컬레이션을 의미하는 한국어 단어
  const koSingle = ['담당자', '상담원'];
  if (koSingle.some((k) => t.includes(k))) return true;

  // 직원/매니저/사람 + 연결/이야기/통화 조합
  const koStaff = ['직원', '매니저', '사람', '직접'];
  const koConnect = ['연결', '이야기', '통화', '상담', '연락', '부탁'];
  if (koStaff.some((k) => t.includes(k)) && koConnect.some((k) => t.includes(k))) return true;

  // 영어
  const en = text.toLowerCase();
  const enPhrases = [
    'speak to staff', 'talk to staff', 'connect to staff',
    'speak to manager', 'talk to manager', 'connect to manager',
    'speak to someone', 'talk to someone', 'talk to a person',
    'talk to human', 'real person', 'human agent', 'connect me',
  ];
  if (enPhrases.some((p) => en.includes(p))) return true;

  // 일본어
  if (['スタッフ', '担当者', 'スタッフに'].some((k) => text.includes(k))) return true;

  // 중국어
  if (['联系客服', '转人工', '人工客服', '找客服'].some((k) => text.includes(k))) return true;

  // 러시아어
  if (t.includes('менеджер') || t.includes('сотрудник')) return true;

  // 스페인어
  if (['hablar con', 'conectar con', 'hablar con gerente'].some((p) => en.includes(p))) return true;

  return false;
}

// --- 매칭 메인 ---

async function match(question) {
  // 에스컬레이션 키워드 선탐지 — FAQ 매칭 전에 처리
  if (isEscalationRequest(question)) return { type: 'escalate' };

  const intents = await loadIntents();
  if (intents.length === 0) return { type: 'escalate' };

  const qTokens = tokenize(question);

  // 각 intent: 모든 질문 변형 중 최고 점수
  const scored = intents.map((intent) => {
    let best = 0;
    for (const { tokens } of intent.variants) {
      const s = jaccard(qTokens, tokens);
      if (s > best) best = s;
    }
    return { intent, score: best };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  if (top.score >= 0.8) {
    return {
      type: 'auto',
      faq: { answer: top.intent.answer },
      confidence: top.score,
    };
  } else if (top.score >= 0.5) {
    const candidates = scored
      .filter((s) => s.score >= 0.5)
      .slice(0, 3)
      .map((s) => ({
        question: s.intent.variants[0].text,
        answer: s.intent.answer,
        score: s.score,
      }));
    return { type: 'candidates', candidates, confidence: top.score };
  } else {
    return { type: 'escalate', confidence: top.score };
  }
}

module.exports = { match, invalidateCache };
