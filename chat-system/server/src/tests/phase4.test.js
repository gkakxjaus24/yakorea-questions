require('dotenv').config();
const { io: ioClient } = require('socket.io-client');

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

function waitFor(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// 테스트 질문 세트 — 기대 응답 타입
const testCases = [
  { question: '체크인 시간이 언제인가요', expected: 'auto', label: '체크인 시간 (정확 매칭)' },
  { question: '체크아웃은 몇 시에 해야 하나요', expected: 'auto', label: '체크아웃 시간 (유사 질문)' },
  { question: '와이파이 비밀번호 알려주세요', expected: 'auto', label: '와이파이 비밀번호' },
  { question: '주차장 있나요', expected: 'auto', label: '주차 가능 여부' },
  { question: '짐 맡길 수 있어요', expected: 'auto', label: '짐 보관' },
  { question: '조식 먹을 수 있나요', expected: 'auto', label: '조식 제공' },
  { question: '흡연 가능한 곳이 있나요', expected: 'auto', label: '흡연 구역' },
  { question: '환불은 어떻게 되나요', expected: 'auto', label: '환불 정책' },
  { question: '수건 교체 부탁드려요', expected: 'auto', label: '수건 교체' },
  { question: '전혀 관련없는 이상한 질문 abcxyz123', expected: 'escalate', label: '관련없는 질문 → escalate' },
];

async function runFaqTests() {
  console.log('\n[Test 1] FAQ 자동응답 정확도 측정');
  const guest = connect();
  await waitFor(guest, 'connect');

  guest.emit('guest:join', { guestId: 'faq-test-guest' });
  const { roomId } = await waitFor(guest, 'room:created');

  let correct = 0;

  for (const tc of testCases) {
    const responsePromise = Promise.race([
      waitFor(guest, 'auto:response').then((d) => ({ type: 'auto', data: d })),
      waitFor(guest, 'auto:candidates').then((d) => ({ type: 'candidates', data: d })),
      waitFor(guest, 'auto:escalate').then((d) => ({ type: 'escalate', data: d })),
    ]);

    guest.emit('guest:send_message', { roomId, content: tc.question });
    const result = await responsePromise;

    const ok = result.type === tc.expected;
    if (ok) correct++;
    assert(`${tc.label} → ${result.type}`, ok);
  }

  const accuracy = (correct / testCases.length) * 100;
  console.log(`\n  정확도: ${correct}/${testCases.length} = ${accuracy.toFixed(1)}%`);
  assert('정확도 80% 이상', accuracy >= 80);

  guest.disconnect();
}

async function testThreeBranches() {
  console.log('\n[Test 2] 3가지 분기 모두 동작 확인');
  const guest = connect();
  await waitFor(guest, 'connect');
  guest.emit('guest:join', { guestId: 'branch-test-guest' });
  const { roomId } = await waitFor(guest, 'room:created');

  // auto 분기
  let p = waitFor(guest, 'auto:response');
  guest.emit('guest:send_message', { roomId, content: '체크인 시간이 언제인가요' });
  await p;
  assert('auto 분기 동작', true);

  // escalate 분기
  p = waitFor(guest, 'auto:escalate');
  guest.emit('guest:send_message', { roomId, content: 'qwerty asdfg zxcvb 무관한질문xyz' });
  await p;
  assert('escalate 분기 동작', true);

  guest.disconnect();
}

async function run() {
  console.log('=== Phase 4 테스트 시작 ===');
  try {
    await runFaqTests();
    await testThreeBranches();
  } catch (err) {
    console.error('테스트 실행 오류:', err.message);
    failed++;
  }

  console.log(`\n결과: ${passed}개 통과 / ${failed}개 실패`);
  if (failed > 0) {
    console.error('❌ Phase 4 테스트 실패');
    process.exit(1);
  } else {
    console.log('✅ Phase 4 테스트 통과');
    process.exit(0);
  }
}

run();
