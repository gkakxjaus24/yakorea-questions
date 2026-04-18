const http = require('http');
const { io: ioClient } = require('socket.io-client');

const BASE_URL = `http://localhost:3001`;
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

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
}

async function testHealth() {
  console.log('\n[Test 1] GET /api/health');
  const res = await get(`${BASE_URL}/api/health`);
  assert('HTTP 200 응답', res.status === 200);
  assert('status: ok', res.body.status === 'ok');
  assert('timestamp 존재', typeof res.body.timestamp === 'string');
}

function testSocket() {
  return new Promise((resolve) => {
    console.log('\n[Test 2] Socket.IO 연결/해제');
    const socket = ioClient(BASE_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
      assert('소켓 연결 성공', true);
      socket.disconnect();
    });

    socket.on('disconnect', () => {
      assert('소켓 해제 성공', true);
      resolve();
    });

    setTimeout(() => {
      if (!socket.connected) {
        assert('소켓 연결 성공', false);
        assert('소켓 해제 성공', false);
        resolve();
      }
    }, 3000);
  });
}

async function run() {
  console.log('=== Phase 1 테스트 시작 ===');
  try {
    await testHealth();
    await testSocket();
  } catch (err) {
    console.error('테스트 실행 오류:', err.message);
    failed++;
  }

  console.log(`\n결과: ${passed}개 통과 / ${failed}개 실패`);
  if (failed > 0) {
    console.error('❌ Phase 1 테스트 실패');
    process.exit(1);
  } else {
    console.log('✅ Phase 1 테스트 통과');
    process.exit(0);
  }
}

run();
