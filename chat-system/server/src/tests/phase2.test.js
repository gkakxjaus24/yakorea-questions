require('dotenv').config();
const http = require('http');

const BASE_URL = 'http://localhost:3001';
let passed = 0;
let failed = 0;
let createdRoomId = null;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function testCreateRoom() {
  console.log('\n[Test 1] POST /api/chat/rooms — 방 생성');
  const res = await request('POST', '/api/chat/rooms', { guest_id: 'test-guest-phase2' });
  assert('HTTP 201 응답', res.status === 201);
  assert('id 존재', typeof res.body.id === 'string');
  assert('status: auto', res.body.status === 'auto');
  assert('guest_id 일치', res.body.guest_id === 'test-guest-phase2');
  createdRoomId = res.body.id;
}

async function testGetMessages() {
  console.log('\n[Test 2] GET /api/chat/rooms/:id/messages — 메시지 목록 조회');
  const res = await request('GET', `/api/chat/rooms/${createdRoomId}/messages`);
  assert('HTTP 200 응답', res.status === 200);
  assert('배열 반환', Array.isArray(res.body));
  assert('빈 배열 (신규 방)', res.body.length === 0);
}

async function testMissingGuestId() {
  console.log('\n[Test 3] POST /api/chat/rooms — guest_id 누락 시 400');
  const res = await request('POST', '/api/chat/rooms', {});
  assert('HTTP 400 응답', res.status === 400);
}

async function run() {
  console.log('=== Phase 2 테스트 시작 ===');
  try {
    await testCreateRoom();
    if (createdRoomId) await testGetMessages();
    else { console.error('  방 생성 실패로 메시지 조회 테스트 건너뜀'); failed++; }
    await testMissingGuestId();
  } catch (err) {
    console.error('테스트 실행 오류:', err.message);
    failed++;
  }

  console.log(`\n결과: ${passed}개 통과 / ${failed}개 실패`);
  if (failed > 0) {
    console.error('❌ Phase 2 테스트 실패');
    process.exit(1);
  } else {
    console.log('✅ Phase 2 테스트 통과');
    process.exit(0);
  }
}

run();
