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

function waitFor(socket, event, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function test1_guestJoinCreatesRoom() {
  console.log('\n[Test 1] 손님 guest:join → room:created 수신');
  const guest = connect();
  await waitFor(guest, 'connect');

  guest.emit('guest:join', { guestId: 'guest-test-1' });
  const data = await waitFor(guest, 'room:created');

  assert('roomId 반환', typeof data.roomId === 'string');

  guest.disconnect();
  return data.roomId;
}

async function test2_guestToManager(roomId) {
  console.log('\n[Test 2] 손님 메시지 → 매니저 수신');
  const guest = connect();
  const manager = connect();

  await Promise.all([waitFor(guest, 'connect'), waitFor(manager, 'connect')]);

  // 손님: 기존 방에 재입장
  guest.emit('guest:join', { roomId, guestId: 'guest-test-1' });
  await waitFor(guest, 'room:created');

  // 매니저: 등록 후 방 입장
  manager.emit('manager:join', { managerId: 'manager-test-1' });
  manager.emit('manager:join_room', { roomId });
  await waitFor(manager, 'room:history');

  // 손님 메시지 전송
  const msgPromise = waitFor(manager, 'guest:message');
  guest.emit('guest:send_message', { roomId, content: '안녕하세요!' });
  const msg = await msgPromise;

  assert('매니저가 손님 메시지 수신', msg.content === '안녕하세요!');

  guest.disconnect();
  manager.disconnect();
}

async function test3_managerToGuest(roomId) {
  console.log('\n[Test 3] 매니저 답장 → 손님 수신');
  const guest = connect();
  const manager = connect();

  await Promise.all([waitFor(guest, 'connect'), waitFor(manager, 'connect')]);

  guest.emit('guest:join', { roomId, guestId: 'guest-test-1' });
  await waitFor(guest, 'room:created');

  manager.emit('manager:join', { managerId: 'manager-test-1' });
  manager.emit('manager:join_room', { roomId });
  await waitFor(manager, 'room:history');

  // 매니저 답장
  const replyPromise = waitFor(guest, 'manager:message');
  manager.emit('manager:send_reply', { roomId, content: '안녕하세요, 무엇을 도와드릴까요?' });
  const reply = await replyPromise;

  assert('손님이 매니저 메시지 수신', reply.content === '안녕하세요, 무엇을 도와드릴까요?');

  guest.disconnect();
  manager.disconnect();
}

async function test4_reconnect(roomId) {
  console.log('\n[Test 4] 재연결 후 guest:join 재전송 → room:created 수신');
  const guest = connect();
  await waitFor(guest, 'connect');

  // 재연결 시 roomId 있으면 guest:join 자동 재전송 시뮬레이션
  guest.emit('guest:join', { roomId, guestId: 'guest-test-1' });
  const data = await waitFor(guest, 'room:created');

  assert('재연결 후 기존 roomId 유지', data.roomId === roomId);

  guest.disconnect();
}

async function run() {
  console.log('=== Phase 3 테스트 시작 ===');
  try {
    const roomId = await test1_guestJoinCreatesRoom();
    await test2_guestToManager(roomId);
    await test3_managerToGuest(roomId);
    await test4_reconnect(roomId);
  } catch (err) {
    console.error('테스트 실행 오류:', err.message);
    failed++;
  }

  console.log(`\n결과: ${passed}개 통과 / ${failed}개 실패`);
  if (failed > 0) {
    console.error('❌ Phase 3 테스트 실패');
    process.exit(1);
  } else {
    console.log('✅ Phase 3 테스트 통과');
    process.exit(0);
  }
}

run();
