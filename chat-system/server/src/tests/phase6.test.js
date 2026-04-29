// Phase 6: 양방향 자동 번역 통합 테스트
// 사전 조건:
//  - 서버가 localhost:3001에서 실행 중
//  - .env에 ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정
//  - translation_logs 테이블 + messages.content_translated 컬럼 + chat_rooms.guest_lang 존재
//  - settings.translation_enabled (이 테스트가 자동 토글)
//
// 검증:
//  Forward
//   1) 플래그 OFF — 일본어 손님 메시지 → 매니저에게 번역 없이 도착
//   2) 플래그 ON — 일본어 손님 메시지 → 매니저에게 영어 번역 같이 도착
//   3) 플래그 ON — 한국어 손님 메시지 → 번역 없음 (불필요 호출 안 함)
//  Backward
//   4) 플래그 ON — 매니저 영어 답변 → 손님에게 번역 없이 도착
//   5) 플래그 ON — 매니저 중국어 답변 + 일본어 손님 → 일본어 번역 도착
//   6) 플래그 ON — 매니저 중국어 답변 + 한국어 손님 → 번역 없음

require('dotenv').config({ override: true });
const { io: ioClient } = require('socket.io-client');
const supabase = require('../services/supabase');

const BASE_URL = 'http://localhost:3001';
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; }
}

function connect() {
  return ioClient(BASE_URL, { transports: ['websocket'] });
}

function waitFor(socket, event, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), timeout);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

async function setFlag(value) {
  const { data: existing } = await supabase
    .from('settings')
    .select('key')
    .eq('key', 'translation_enabled')
    .maybeSingle();
  if (existing) {
    await supabase.from('settings').update({ value }).eq('key', 'translation_enabled');
  } else {
    await supabase.from('settings').insert({ key: 'translation_enabled', value });
  }
}

// 매니저 시뮬레이션 — 같은 룸에 join하고 메시지 받기 + send_reply
function joinAsManager(roomId) {
  return new Promise(async (resolve) => {
    const mgr = connect();
    await waitFor(mgr, 'connect');
    mgr.emit('manager:join', { managerId: 'phase6-mgr-' + Date.now() });
    mgr.emit('manager:join_room', { roomId });
    // history 로드 끝날 때까지 잠깐 대기
    await waitFor(mgr, 'room:history', 5000).catch(() => {});
    resolve(mgr);
  });
}

// ── Forward ────────────────────────────────────────────────────

async function testForwardOff() {
  console.log('\n[Test 1] Forward — 플래그 OFF: 일본어 메시지 번역 없이 전달');
  await setFlag('false');

  const guest = connect();
  await waitFor(guest, 'connect');
  guest.emit('guest:join', { guestId: 'phase6-fwd-off-' + Date.now() });
  const { roomId } = await waitFor(guest, 'room:created');
  const mgr = await joinAsManager(roomId);

  const p = waitFor(mgr, 'guest:message', 8000);
  guest.emit('guest:send_message', { roomId, content: 'こんにちは、何時にチェックインできますか?', lang: 'ja' });
  const msg = await p.catch(() => null);

  assert('매니저 수신 OK', !!msg);
  assert('번역 없음 (translated == null)', msg && !msg.translated);
  guest.disconnect(); mgr.disconnect();
}

async function testForwardOnJapanese() {
  console.log('\n[Test 2] Forward — 플래그 ON: 일본어 → 영어 번역 같이 도착');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠ ANTHROPIC_API_KEY 없음 — 스킵'); return;
  }
  await setFlag('true');

  const guest = connect();
  await waitFor(guest, 'connect');
  guest.emit('guest:join', { guestId: 'phase6-fwd-ja-' + Date.now() });
  const { roomId } = await waitFor(guest, 'room:created');
  const mgr = await joinAsManager(roomId);

  const p = waitFor(mgr, 'guest:message', 15000);
  guest.emit('guest:send_message', { roomId, content: 'こんにちは、何時にチェックインできますか?', lang: 'ja' });
  const msg = await p.catch(() => null);

  assert('매니저 수신 OK', !!msg);
  assert('translated 필드 존재', !!(msg && msg.translated && msg.translated.length > 3));
  assert('originalLang === "ja"', msg && msg.originalLang === 'ja');
  if (msg?.translated) console.log(`    번역문: "${msg.translated}"`);
  guest.disconnect(); mgr.disconnect();
}

async function testForwardOnKorean() {
  console.log('\n[Test 3] Forward — 한국어 메시지: 번역 호출 안 함');
  await setFlag('true');

  const guest = connect();
  await waitFor(guest, 'connect');
  guest.emit('guest:join', { guestId: 'phase6-fwd-ko-' + Date.now() });
  const { roomId } = await waitFor(guest, 'room:created');
  const mgr = await joinAsManager(roomId);

  const p = waitFor(mgr, 'guest:message', 8000);
  guest.emit('guest:send_message', { roomId, content: '안녕하세요 체크인 시간 알려주세요', lang: 'ko' });
  const msg = await p.catch(() => null);

  assert('매니저 수신 OK', !!msg);
  assert('번역 없음 (한국어는 매니저가 읽음)', msg && !msg.translated);
  guest.disconnect(); mgr.disconnect();
}

// ── Backward ───────────────────────────────────────────────────

async function setupRoomWithGuestLang(lang, content) {
  // 손님이 먼저 메시지 보내서 chat_rooms.guest_lang 저장됨
  const guest = connect();
  await waitFor(guest, 'connect');
  guest.emit('guest:join', { guestId: 'phase6-back-' + Date.now() });
  const { roomId } = await waitFor(guest, 'room:created');
  const mgr = await joinAsManager(roomId);
  guest.emit('guest:send_message', { roomId, content, lang });
  // 손님 메시지가 매니저에게 도착할 때까지 대기 (이때 guest_lang 저장됨)
  await waitFor(mgr, 'guest:message', 8000).catch(() => {});
  // 약간의 처리 지연 + chat_rooms update 완료 대기
  await new Promise((r) => setTimeout(r, 700));
  return { guest, mgr, roomId };
}

async function testBackwardManagerEnglish() {
  console.log('\n[Test 4] Backward — 매니저 영어 답변: 번역 없음');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠ ANTHROPIC_API_KEY 없음 — 스킵'); return;
  }
  await setFlag('true');
  const { guest, mgr, roomId } = await setupRoomWithGuestLang('ja', 'こんにちは');

  const p = waitFor(guest, 'manager:message', 8000);
  mgr.emit('manager:send_reply', { roomId, content: 'Check-in is at 3pm.' });
  const msg = await p.catch(() => null);

  assert('손님 수신 OK', !!msg);
  assert('영어 답변은 번역 안 함', msg && !msg.translated);
  guest.disconnect(); mgr.disconnect();
}

async function testBackwardManagerChineseToJapanese() {
  console.log('\n[Test 5] Backward — 매니저 중국어 + 일본어 손님: 일본어 번역 도착');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠ ANTHROPIC_API_KEY 없음 — 스킵'); return;
  }
  await setFlag('true');
  const { guest, mgr, roomId } = await setupRoomWithGuestLang('ja', 'こんにちは');

  const p = waitFor(guest, 'manager:message', 15000);
  mgr.emit('manager:send_reply', { roomId, content: '入住时间是下午3点。' });
  const msg = await p.catch(() => null);

  assert('손님 수신 OK', !!msg);
  assert('translated 필드 존재', !!(msg && msg.translated && msg.translated.length > 3));
  assert('originalLang === "zh"', msg && msg.originalLang === 'zh');
  if (msg?.translated) console.log(`    번역문(JA): "${msg.translated}"`);
  guest.disconnect(); mgr.disconnect();
}

async function testBackwardManagerChineseToKorean() {
  console.log('\n[Test 6] Backward — 매니저 중국어 + 한국어 손님: 번역 안 함');
  await setFlag('true');
  const { guest, mgr, roomId } = await setupRoomWithGuestLang('ko', '안녕하세요');

  const p = waitFor(guest, 'manager:message', 8000);
  mgr.emit('manager:send_reply', { roomId, content: '入住时间是下午3点。' });
  const msg = await p.catch(() => null);

  assert('손님 수신 OK', !!msg);
  assert('한국어 손님은 매니저 중국어를 그대로 봐도 OK (번역 안 함)', msg && !msg.translated);
  guest.disconnect(); mgr.disconnect();
}

// ── 실행 ────────────────────────────────────────────────────────

async function run() {
  console.log('=== Phase 6 (양방향 자동 번역) 테스트 시작 ===');
  console.log('  서버가 localhost:3001에서 실행 중이어야 합니다.');
  try {
    await testForwardOff();
    await testForwardOnJapanese();
    await testForwardOnKorean();
    await testBackwardManagerEnglish();
    await testBackwardManagerChineseToJapanese();
    await testBackwardManagerChineseToKorean();
  } catch (err) {
    console.error('테스트 실행 오류:', err.message);
    console.error(err.stack);
    failed++;
  } finally {
    await setFlag('false').catch(() => {});
    console.log('\n  (정리: translation_enabled=false로 복구)');
  }

  console.log(`\n결과: ${passed}개 통과 / ${failed}개 실패`);
  if (failed > 0) {
    console.error('❌ Phase 6 테스트 실패');
    process.exit(1);
  } else {
    console.log('✅ Phase 6 테스트 통과');
    process.exit(0);
  }
}

run();
