// Phase 5: LLM 폴백 통합 테스트
// 사전 조건:
//  - 서버가 localhost:3001에서 실행 중
//  - .env에 ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정
//  - settings.llm_fallback_enabled='true' (이 테스트는 자동으로 켰다 끔)
//  - llm_fallback_logs 테이블 존재
//
// 검증:
//  1. 플래그 OFF — Jaccard 못 잡으면 즉시 escalate
//  2. 플래그 ON + 답할 수 있는 질문 → auto:response (LLM 답변)
//  3. 플래그 ON + 무관한 질문 → NO_MATCH → escalate fall-through
//  4. typing 인디케이터 on/off 이벤트
//  5. llm_fallback_logs에 로그 기록 확인

require('dotenv').config({ override: true });
const { io: ioClient } = require('socket.io-client');
const supabase = require('../services/supabase');

const BASE_URL = 'http://localhost:3001';
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function connect() {
  return ioClient(BASE_URL, { transports: ['websocket'] });
}

function waitFor(socket, event, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function setFlag(value) {
  const { data: existing } = await supabase
    .from('settings')
    .select('key')
    .eq('key', 'llm_fallback_enabled')
    .maybeSingle();
  if (existing) {
    await supabase.from('settings').update({ value }).eq('key', 'llm_fallback_enabled');
  } else {
    await supabase.from('settings').insert({ key: 'llm_fallback_enabled', value });
  }
  // faqMatcher 캐시는 settings 변경과 무관, llmFallback.isEnabled은 매 호출 시 DB 조회
}

// 학습 데이터에 직접 일치하지 않지만 DB 답변에 정보가 있는 질문
// (Jaccard로는 못 잡고 LLM이 잡을 가능성이 높음)
const LLM_ANSWERABLE = '문 비밀번호 5분 후에 바꿔주실 수 있나요'; // password_change 관련
// 완전히 무관한 질문 — LLM도 NO_MATCH 해야 함
const UNRELATED = '오늘 코스피 지수가 얼마야';

async function testFlagOff() {
  console.log('\n[Test 1] llm_fallback_enabled=false 시 기존 escalate 흐름 유지');
  await setFlag('false');
  await new Promise((r) => setTimeout(r, 500));

  const guest = connect();
  await waitFor(guest, 'connect');
  guest.emit('guest:join', { guestId: 'phase5-off-' + Date.now() });
  const { roomId } = await waitFor(guest, 'room:created');

  const p = Promise.race([
    waitFor(guest, 'auto:escalate', 10000).then((d) => ({ type: 'escalate', data: d })),
    waitFor(guest, 'auto:response', 10000).then((d) => ({ type: 'auto', data: d })),
  ]);
  guest.emit('guest:send_message', { roomId, content: UNRELATED, lang: 'ko' });
  const result = await p.catch((e) => ({ type: 'timeout', error: e.message }));

  assert('플래그 OFF — 무관 질문은 즉시 escalate', result.type === 'escalate');
  guest.disconnect();
}

async function testFlagOnAnswerable() {
  console.log('\n[Test 2] 플래그 ON — DB로 답할 수 있는 질문은 LLM이 답함');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠ ANTHROPIC_API_KEY 없음 — 이 테스트는 스킵');
    return;
  }
  await setFlag('true');
  await new Promise((r) => setTimeout(r, 500));

  const guest = connect();
  await waitFor(guest, 'connect');
  guest.emit('guest:join', { guestId: 'phase5-on-' + Date.now() });
  const { roomId } = await waitFor(guest, 'room:created');

  let typingOn = false;
  let typingOff = false;
  guest.on('auto:typing', ({ on }) => {
    if (on) typingOn = true;
    else typingOff = true;
  });

  const p = Promise.race([
    waitFor(guest, 'auto:response', 15000).then((d) => ({ type: 'auto', data: d })),
    waitFor(guest, 'auto:escalate', 15000).then((d) => ({ type: 'escalate', data: d })),
  ]);
  guest.emit('guest:send_message', { roomId, content: LLM_ANSWERABLE, lang: 'ko' });
  const result = await p.catch((e) => ({ type: 'timeout', error: e.message }));

  assert('LLM이 답변 생성 (auto:response)', result.type === 'auto');
  if (result.type === 'auto') {
    assert('답변 텍스트 존재', !!result.data?.content && result.data.content.length > 5);
    assert('source=llm 표시', result.data?.source === 'llm');
  }
  assert('typing on 이벤트 수신', typingOn);
  assert('typing off 이벤트 수신', typingOff);
  guest.disconnect();
}

async function testFlagOnUnrelated() {
  console.log('\n[Test 3] 플래그 ON + 무관한 질문 → NO_MATCH → escalate');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠ ANTHROPIC_API_KEY 없음 — 이 테스트는 스킵');
    return;
  }

  // 야간이면 escalate 대신 야간안내가 가므로 시간 체크
  const kstHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  const isNight = kstHour >= 0 && kstHour < 8;

  const guest = connect();
  await waitFor(guest, 'connect');
  guest.emit('guest:join', { guestId: 'phase5-unrel-' + Date.now() });
  const { roomId } = await waitFor(guest, 'room:created');

  const expected = isNight ? 'auto' : 'escalate';
  const p = Promise.race([
    waitFor(guest, 'auto:response', 15000).then((d) => ({ type: 'auto', data: d })),
    waitFor(guest, 'auto:escalate', 15000).then((d) => ({ type: 'escalate', data: d })),
  ]);
  guest.emit('guest:send_message', { roomId, content: UNRELATED, lang: 'ko' });
  const result = await p.catch((e) => ({ type: 'timeout', error: e.message }));

  assert(
    `무관 질문 — LLM이 NO_MATCH → ${expected} 흐름`,
    result.type === expected,
  );
  guest.disconnect();
}

async function testLogTable() {
  console.log('\n[Test 4] llm_fallback_logs 기록 확인');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠ ANTHROPIC_API_KEY 없음 — 이 테스트는 스킵');
    return;
  }
  // 직전 LLM 호출이 1~3회 있었으므로 최근 5분 내 로그가 있어야 함
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('llm_fallback_logs')
    .select('id, question, language, matched, input_tokens, output_tokens, latency_ms')
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    assert(`로그 테이블 조회 실패: ${error.message}`, false);
    return;
  }
  assert(`최근 LLM 로그 ${data.length}건 존재`, data.length > 0);
  if (data.length > 0) {
    const r = data[0];
    console.log(
      `    최근 호출: matched=${r.matched}, in=${r.input_tokens}, out=${r.output_tokens}, latency=${r.latency_ms}ms`,
    );
    assert('input_tokens 기록됨', typeof r.input_tokens === 'number');
    assert('latency_ms 기록됨', typeof r.latency_ms === 'number');
  }
}

async function run() {
  console.log('=== Phase 5 (LLM 폴백) 테스트 시작 ===');
  console.log('  서버가 localhost:3001에서 실행 중이어야 합니다.');

  try {
    await testFlagOff();
    await testFlagOnAnswerable();
    await testFlagOnUnrelated();
    await testLogTable();
  } catch (err) {
    console.error('테스트 실행 오류:', err.message);
    console.error(err.stack);
    failed++;
  } finally {
    // 테스트 끝나면 플래그를 원상복구 — 안전을 위해 OFF로
    await setFlag('false').catch(() => {});
    console.log('\n  (정리: llm_fallback_enabled=false로 복구)');
  }

  console.log(`\n결과: ${passed}개 통과 / ${failed}개 실패`);
  if (failed > 0) {
    console.error('❌ Phase 5 테스트 실패');
    process.exit(1);
  } else {
    console.log('✅ Phase 5 테스트 통과');
    process.exit(0);
  }
}

run();
