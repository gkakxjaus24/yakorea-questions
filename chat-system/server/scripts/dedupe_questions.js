/**
 * intent_questions 테이블 중복 행 제거
 * (intent_id, language, question_text) 기준
 */
require('dotenv').config();
const supabase = require('../src/services/supabase');

async function fetchAll() {
  const all = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('intent_questions')
      .select('id, intent_id, language, question_text')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function run() {
  const rows = await fetchAll();
  console.log(`[dedupe] 전체 ${rows.length}개 행`);

  const seen = new Set();
  const toDelete = [];
  for (const r of rows) {
    const key = `${r.intent_id}::${r.language}::${r.question_text}`;
    if (seen.has(key)) {
      toDelete.push(r.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`[dedupe] 중복 ${toDelete.length}개 발견, 삭제 시작...`);
  if (toDelete.length === 0) {
    console.log('[dedupe] 중복 없음.');
    process.exit(0);
  }

  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const { error } = await supabase.from('intent_questions').delete().in('id', batch);
    if (error) {
      console.error(`[ERROR] 배치 ${i}:`, error.message);
    } else {
      total += batch.length;
      process.stdout.write(`\r[dedupe] 삭제 중... ${total}/${toDelete.length}`);
    }
  }
  console.log(`\n[dedupe] 완료! ${total}개 삭제됨`);
  console.log(`[dedupe] 남은 행: ${rows.length - total}개`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
