const supabase = require('./supabase');

// --- 토크나이저 & 유사도 ---

// ── 한국어 조사 목록 — 긴 것부터 순서 중요 ───────────────────────
const KO_PARTICLES = [
  '에서는','에게는','으로는','이라고','이에요','이어요',
  '에서','에게','으로','이랑','하고','라고','부터','까지',
  '를','을','는','은','가','이','도','와','과','의','로','에',
];

function stripKoParticle(token) {
  if (!/[\uAC00-\uD7A3]/.test(token)) return null;
  for (const p of KO_PARTICLES) {
    if (token.endsWith(p) && token.length > p.length + 1) {
      return token.slice(0, -p.length);
    }
  }
  return null;
}

// ── 한국어 동사 어미 정규화 ──────────────────────────────────────

// 불규칙 변환 맵 (됩니다→되, 안돼요→안되 등 어간이 달라지는 형태)
const KO_STEM_MAP = {
  // 되다
  '됩니다':'되','됩니까':'되','돼요':'되','되요':'되','됐어요':'되','됐습니다':'되',
  // 안되다
  '안됩니다':'안되','안됩니까':'안되','안돼요':'안되','안되요':'안되','안됐어요':'안되',
  // 하다
  '합니다':'하','합니까':'하','해요':'하','했어요':'하','할게요':'하','해줘요':'하',
  // 있다
  '있습니다':'있','있어요':'있','있나요':'있','있습니까':'있','있을까요':'있',
  // 없다
  '없습니다':'없','없어요':'없','없나요':'없','없습니까':'없','없을까요':'없',
  // 싶다
  '싶습니다':'싶','싶어요':'싶','싶나요':'싶',
  // 주다
  '줍니다':'주','줘요':'주','주세요':'주',
  // 오다
  '옵니다':'오','와요':'오','왔어요':'오',
  // 가다
  '갑니다':'가','가요':'가','갔어요':'가',
};

// 규칙형 어미 목록 — 긴 것부터 순서 중요
const KO_ENDINGS = [
  '겠습니다','았습니다','었습니다',
  '겠어요','았어요','었어요',
  '습니다','습니까',
  '까지요','부터요','에서요','인가요','인데요','라고요','거든요',
  '아요','어요','나요','세요','네요','지요','거요','라요','에요','예요','는가요',
  '니다',
];

function stripKoEnding(token) {
  if (!/[\uAC00-\uD7A3]/.test(token)) return null;
  // 불규칙 우선
  if (KO_STEM_MAP[token]) return KO_STEM_MAP[token];
  // 규칙 어미 제거
  for (const e of KO_ENDINGS) {
    if (token.endsWith(e) && token.length > e.length + 1) {
      return token.slice(0, -e.length);
    }
  }
  return null;
}

function tokenize(text) {
  // CJK(중국어/일본어): 문자 단위 분리 (띄어쓰기 없음)
  const cjk = text.match(/[\u4e00-\u9fff\u3040-\u30ff\u31f0-\u31ff]/g) || [];

  // 나머지(한국어/라틴/키릴/스페인어 특수문자 등): 공백 기준 분리
  const rest = text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff\u31f0-\u31ff]/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  // 각 토큰에 조사 제거 + 어미 정규화 형태를 추가 (원본 항상 유지)
  const expanded = [];
  for (const t of rest) {
    expanded.push(t);

    // 1. 조사 제거
    const noParticle = stripKoParticle(t);
    if (noParticle) expanded.push(noParticle);

    // 2. 어미 정규화 (원본 기준)
    const noEnding = stripKoEnding(t);
    if (noEnding) {
      expanded.push(noEnding);
      // 2-1. 어미 제거 후 조사 제거 (예: "몇시부터에요" → "몇시부터" → "몇시")
      const stemFromNoEnding = stripKoParticle(noEnding);
      if (stemFromNoEnding) expanded.push(stemFromNoEnding);
    }

    // 3. 조사 제거 후 어미 정규화 (조합)
    if (noParticle) {
      const noEndingFromStem = stripKoEnding(noParticle);
      if (noEndingFromStem) expanded.push(noEndingFromStem);
    }
  }

  return new Set([...cjk, ...expanded]);
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

// 전체 질문 페이지네이션 로드 (Supabase 기본 한도 1000행 우회)
async function fetchAllQuestions() {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('intent_questions')
      .select('intent_id, question_text')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function loadIntents() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;

  const [questions, [{ data: answers, error: aErr }, { data: settings, error: sErr }]] =
    await Promise.all([
      fetchAllQuestions(),
      Promise.all([
        supabase.from('intent_answers').select('intent_id, answer_template').eq('language', 'ko'),
        supabase.from('settings').select('key, value'),
      ]),
    ]);

  const qErr = null;
  if (aErr || sErr) throw aErr || sErr;

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
  console.log(`[FAQ] ${_cache.length}개 intent 로드 완료 (전체 언어 질문 변형 총 ${(questions || []).length}개)`);
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
