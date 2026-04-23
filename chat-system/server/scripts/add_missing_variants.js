/**
 * 실패 패턴 보강 — 조식/체크아웃/택시/세탁실 "몇시에요/까지요/어디서/어디에요"
 */
require('dotenv').config();
const s = require('../src/services/supabase');

const DATA = {
  breakfast_info: [
    '조식은 몇시에요','조식 몇시에요','조식은 몇시예요','조식 몇시예요',
    '조식은 몇시인가요','조식 몇시인가요','조식은 언제인가요','조식은 언제에요',
    '조식 언제에요','조식 시간 몇시에요','아침 몇시에요','아침밥 몇시에요',
    '조식은 몇시부터요','조식 몇시부터요','아침 식사 몇시에요','조식은 몇시까지에요',
    '조식 몇시까지에요','조식은 몇시부터 몇시까지에요','조식 몇시부터 몇시까지에요',
  ],
  check_out_time: [
    '체크아웃 몇시까지요','체크아웃은 몇시까지요','체크아웃 몇시까지에요','체크아웃은 몇시까지에요',
    '체크아웃 몇시예요','체크아웃은 몇시예요','체크아웃 몇시인가요','체크아웃은 몇시인가요',
    '퇴실 몇시까지요','퇴실은 몇시까지요','퇴실 몇시까지에요','퇴실은 몇시까지에요',
    '체크아웃 언제까지에요','체크아웃은 언제까지에요','퇴실 언제까지에요',
    '몇시까지 체크아웃 해야되요','몇시까지 퇴실이에요','몇시까지 나가야되요',
    '체크아웃 시간 몇시에요','퇴실 시간 몇시에요',
  ],
  taxi_info: [
    '택시 어디서 타나요','택시는 어디서 타나요','택시 어디서 타요','택시는 어디서 타요',
    '택시 타는 곳 어디에요','택시 타는 곳이 어디에요','택시 타는곳 어디에요',
    '택시 승강장 어디에요','택시 승차장 어디에요','어디서 택시 타요','어디서 택시 타나요',
    '택시 어디서 잡아요','택시는 어디서 잡아요','택시 어디에서 타요',
    '택시 정류장 어디에요','택시 어떻게 타요','택시 타는 법',
  ],
  laundry_info: [
    '세탁실은 어디에요','세탁실 어디에요','세탁실이 어디에요','세탁실은 어디예요',
    '세탁실 어디예요','세탁실 위치가 어디에요','세탁실 어디 있어요','세탁실은 어디 있어요',
    '세탁실 어디인가요','세탁기 어디에요','세탁기는 어디에요','세탁기 어디 있어요',
    '빨래는 어디서 해요','빨래 어디서 해요','세탁은 어디서 해요','세탁 어디서 해요',
    '세탁실 가는 법','세탁기 위치','세탁실 층',
  ],
};

(async () => {
  const rows = [];
  for (const [intent_id, qs] of Object.entries(DATA)) {
    for (const q of qs) rows.push({ intent_id, language: 'ko', question_text: q });
  }

  // 기존 중복 제거
  const intentIds = [...new Set(rows.map(r => r.intent_id))];
  const existing = [];
  let from = 0;
  while (true) {
    const { data, error } = await s.from('intent_questions')
      .select('intent_id, question_text')
      .in('intent_id', intentIds)
      .eq('language', 'ko')
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    existing.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const seen = new Set(existing.map(r => `${r.intent_id}::${r.question_text}`));
  const toInsert = rows.filter(r => !seen.has(`${r.intent_id}::${r.question_text}`));
  console.log(`[add] 전체 ${rows.length}개 중 신규 ${toInsert.length}개 삽입`);

  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error } = await s.from('intent_questions').insert(batch);
    if (error) { console.error('ERR:', error.message); continue; }
    console.log(`  ${i + batch.length}/${toInsert.length} 완료`);
  }
  console.log('[add] 완료');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
