/**
 * 몽골어(mn) intent 답변 + 질문 변형 시드 스크립트
 *
 * 동작 방식:
 *   1. DB에서 language='en' 답변 전체 조회
 *   2. Claude Haiku로 일괄 번역 (몽골어 키릴)
 *   3. intent_answers에 mn 언어로 upsert
 *   4. DB에서 language='en' 질문 변형 조회 (intent당 최대 8개)
 *   5. Claude Haiku로 일괄 번역
 *   6. intent_questions에 mn 언어로 삽입 (기존 mn 삭제 후 재삽입)
 *
 * 실행: node src/scripts/add_mongolian_questions_answers.js
 */
require('dotenv').config({ override: true });
const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../services/supabase');

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다.'); process.exit(1); }
const client = new Anthropic({ apiKey: KEY });
const TARGET_LANG = 'mn';
const TARGET_LANG_NAME = 'Mongolian (Cyrillic script, modern Mongolian)';
const SOURCE_LANG = 'en';

// ── Haiku 번역 헬퍼 ──────────────────────────────────────────────────────────
async function translateBatch(items, type = 'answer') {
  if (items.length === 0) return [];

  const numbered = items.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const instruction = type === 'answer'
    ? `You are translating hostel FAQ answers from English to ${TARGET_LANG_NAME}.
Rules:
- Keep the same meaning and tone (friendly, helpful)
- Preserve any email addresses, phone numbers, and prices exactly as-is
- Do NOT translate proper nouns like "Yakorea Hostel", "AREX", "KRW", "dongdaemun2@gmail.com"
- Keep {{variable}} placeholders unchanged
- Output ONLY the numbered translations, one per line, no extra text`
    : `You are translating hostel FAQ questions/queries from English to ${TARGET_LANG_NAME}.
Rules:
- Keep the meaning natural and conversational (how a guest would ask)
- Vary phrasing slightly between different variants of the same question
- Do NOT translate proper nouns or brand names
- Output ONLY the numbered translations, one per line, no extra text`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `${instruction}\n\nTranslate these ${items.length} ${type}s:\n${numbered}`,
    }],
  });

  const lines = response.content[0].text.trim().split('\n').filter(l => l.trim());
  return lines.map(l => l.replace(/^\d+\.\s*/, '').trim());
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('═'.repeat(60));
  console.log(' 🇲🇳 몽골어 FAQ 시드 시작');
  console.log('═'.repeat(60));

  // ── 1. 영어 답변 전체 조회 ─────────────────────────────────────────────────
  console.log('\n[1/4] intent_answers(en) 조회 중...');
  const { data: enAnswers, error: aErr } = await supabase
    .from('intent_answers')
    .select('intent_id, answer_template')
    .eq('language', SOURCE_LANG);

  if (aErr) { console.error('답변 조회 실패:', aErr.message); process.exit(1); }
  console.log(`  → ${enAnswers.length}개 intent 답변 발견`);

  // ── 2. 답변 번역 (배치 20개씩) ────────────────────────────────────────────
  console.log('\n[2/4] 답변 몽골어 번역 중...');
  const BATCH_SIZE = 20;
  const mnAnswers = [];

  for (let i = 0; i < enAnswers.length; i += BATCH_SIZE) {
    const batch = enAnswers.slice(i, i + BATCH_SIZE);
    const texts = batch.map(r => r.answer_template);
    process.stdout.write(`  배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(enAnswers.length / BATCH_SIZE)} 번역 중...`);
    const translated = await translateBatch(texts, 'answer');
    batch.forEach((r, idx) => {
      mnAnswers.push({
        intent_id: r.intent_id,
        language: TARGET_LANG,
        answer_template: translated[idx] || texts[idx],
      });
    });
    console.log(' ✅');
    await new Promise(res => setTimeout(res, 500)); // rate limit 방지
  }

  // ── 3. 답변 upsert ────────────────────────────────────────────────────────
  console.log('\n[3/4] intent_answers(mn) upsert 중...');
  let answerOk = 0, answerFail = 0;
  for (const row of mnAnswers) {
    const { error } = await supabase
      .from('intent_answers')
      .upsert(row, { onConflict: 'intent_id,language' });
    if (error) {
      // upsert 실패 시 insert 시도
      const { error: e2 } = await supabase.from('intent_answers').insert(row);
      if (e2) { console.error(`  ❌ [${row.intent_id}] ${e2.message}`); answerFail++; }
      else answerOk++;
    } else {
      answerOk++;
    }
  }
  console.log(`  → ✅ ${answerOk}개 upsert / ❌ ${answerFail}개 실패`);

  // ── 4. 영어 질문 변형 조회 (intent당 최대 8개) ─────────────────────────────
  console.log('\n[4/6] intent_questions(en) 조회 중...');
  const { data: enQuestions, error: qErr } = await supabase
    .from('intent_questions')
    .select('intent_id, question_text')
    .eq('language', SOURCE_LANG);

  if (qErr) { console.error('질문 조회 실패:', qErr.message); process.exit(1); }

  // intent당 최대 8개로 제한
  const byIntent = {};
  for (const row of enQuestions) {
    if (!byIntent[row.intent_id]) byIntent[row.intent_id] = [];
    if (byIntent[row.intent_id].length < 8) byIntent[row.intent_id].push(row.question_text);
  }
  const intentIds = Object.keys(byIntent);
  const allEnQ = intentIds.flatMap(id => byIntent[id]);
  console.log(`  → ${intentIds.length}개 intent, ${allEnQ.length}개 질문 변형 (intent당 최대 8개)`);

  // ── 5. 질문 번역 (배치 30개씩) ────────────────────────────────────────────
  console.log('\n[5/6] 질문 변형 몽골어 번역 중...');
  const Q_BATCH = 30;
  const allMnQ = [];

  for (let i = 0; i < allEnQ.length; i += Q_BATCH) {
    const batch = allEnQ.slice(i, i + Q_BATCH);
    process.stdout.write(`  배치 ${Math.floor(i / Q_BATCH) + 1}/${Math.ceil(allEnQ.length / Q_BATCH)} 번역 중...`);
    const translated = await translateBatch(batch, 'question');
    allMnQ.push(...translated.map((t, idx) => ({ en: batch[idx], mn: t })));
    console.log(' ✅');
    await new Promise(res => setTimeout(res, 500));
  }

  // intentId 매핑 복원
  const mnQuestionRows = [];
  const translationMap = Object.fromEntries(allMnQ.map(r => [r.en, r.mn]));
  for (const [intentId, enQs] of Object.entries(byIntent)) {
    for (const enQ of enQs) {
      const mnQ = translationMap[enQ];
      if (mnQ) mnQuestionRows.push({ intent_id: intentId, language: TARGET_LANG, question_text: mnQ });
    }
  }

  // ── 6. 질문 삽입 (기존 mn 삭제 후 재삽입) ────────────────────────────────
  console.log('\n[6/6] intent_questions(mn) 삽입 중...');

  // 기존 mn 질문 일괄 삭제
  const { error: delErr } = await supabase
    .from('intent_questions')
    .delete()
    .eq('language', TARGET_LANG);
  if (delErr) console.warn('  ⚠️  기존 mn 질문 삭제 실패:', delErr.message);

  // 50개씩 나눠 삽입 (Supabase 요청 크기 제한 방지)
  let qOk = 0, qFail = 0;
  for (let i = 0; i < mnQuestionRows.length; i += 50) {
    const chunk = mnQuestionRows.slice(i, i + 50);
    const { error } = await supabase.from('intent_questions').insert(chunk);
    if (error) { console.error(`  ❌ 청크 ${i}-${i+50}: ${error.message}`); qFail += chunk.length; }
    else qOk += chunk.length;
  }
  console.log(`  → ✅ ${qOk}개 질문 변형 삽입 / ❌ ${qFail}개 실패`);

  // ── 요약 ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(` 완료: 답변 ${answerOk}개, 질문 ${qOk}개`);
  console.log(' FAQ 캐시는 5분 후 자동 갱신됩니다.');
  console.log('═'.repeat(60));
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
