const { test, expect } = require('@playwright/test');

const TEST_PAGE = 'http://localhost:3001/widget/tests/test-page.html';

async function openWidget(page) {
  await page.evaluate(() =>
    document.querySelector('#ya-chat-widget-host').shadowRoot
      .querySelector('#toggle-btn').click()
  );
  // 서버 응답으로 환영 메시지가 뜰 때까지 대기
  await page.waitForFunction(
    () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('.msg.system'),
    { timeout: 8000 }
  );
}

async function sendGuestMessage(page, text) {
  await page.evaluate((t) => {
    const sr = document.querySelector('#ya-chat-widget-host').shadowRoot;
    sr.querySelector('#msg-input').value = t;
    sr.querySelector('#send-btn').click();
  }, text);
}

async function getRoomId(page) {
  return page.evaluate(() => sessionStorage.getItem('ya_chat_room_id'));
}

test.describe('Phase 8 — 세션 관리 재설계', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_PAGE);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('#toggle-btn')
    );
  });

  test('1. 상태 배지 표시 (자동응답 중)', async ({ page }) => {
    await openWidget(page);
    const status = await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#status-text').textContent.trim()
    );
    expect(status).toContain('자동응답');
  });

  test('2. 손님이 대화 종료 → 새 방 생성', async ({ page }) => {
    await openWidget(page);
    await sendGuestMessage(page, '체크인 시간');
    await page.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('.msg.auto'),
      { timeout: 8000 }
    );

    const firstRoomId = await getRoomId(page);
    expect(firstRoomId).toBeTruthy();

    // 대화 종료 — confirm 자동 수락
    page.once('dialog', (d) => d.accept());
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#close-btn').click()
    );

    // sessionStorage 초기화 확인
    await page.waitForFunction(() => !sessionStorage.getItem('ya_chat_room_id'), { timeout: 3000 });

    // 상태가 closed 로 바뀜
    const status = await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#status-text').textContent.trim()
    );
    expect(status).toContain('종료');

    // 입력창 비활성화
    const disabled = await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#msg-input').disabled
    );
    expect(disabled).toBe(true);

    // 다시 위젯 토글해서 새 방 생성되는지 확인 (현재 열려있으니 두 번 클릭)
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#toggle-btn').click()
    );
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#toggle-btn').click()
    );

    await page.waitForFunction(
      () => {
        const rid = sessionStorage.getItem('ya_chat_room_id');
        return rid && rid.length > 0;
      },
      { timeout: 8000 }
    );

    const newRoomId = await getRoomId(page);
    expect(newRoomId).toBeTruthy();
    expect(newRoomId).not.toBe(firstRoomId);
  });

  test('3. 자동 재연결 — 같은 방 유지 (closed 아닐 때)', async ({ page }) => {
    await openWidget(page);
    await sendGuestMessage(page, '체크인');
    await page.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('.msg.auto'),
      { timeout: 8000 }
    );

    const originalRoomId = await getRoomId(page);
    expect(originalRoomId).toBeTruthy();

    // 페이지 새로고침 (재연결 시뮬레이션, sessionStorage 유지됨)
    await page.reload();
    await page.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('#toggle-btn')
    );

    // 위젯 토글만 해서 소켓 연결 — 환영 메시지는 안 뜨므로 sessionStorage 기준으로 대기
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#toggle-btn').click()
    );

    // room:created 응답을 받아 sessionStorage에 roomId가 있는 상태 유지 확인
    await page.waitForFunction(
      (original) => sessionStorage.getItem('ya_chat_room_id') === original,
      originalRoomId,
      { timeout: 8000 }
    );

    const reconnectedRoomId = await getRoomId(page);
    expect(reconnectedRoomId).toBe(originalRoomId);
  });

  test('4. 매니저가 종료 → 손님 위젯에 종료 알림', async ({ page, request }) => {
    await openWidget(page);
    await sendGuestMessage(page, '안녕하세요');
    await page.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('.msg.guest'),
      { timeout: 5000 }
    );

    const roomId = await getRoomId(page);
    expect(roomId).toBeTruthy();

    // 매니저 소켓으로 close_room 호출 (직접 socket.io-client 사용)
    await page.evaluate(async (rid) => {
      await new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'http://localhost:3001/socket.io/socket.io.js';
        s.onload = resolve;
        document.head.appendChild(s);
      });
      const mgrSocket = window.io('http://localhost:3001', { transports: ['websocket'] });
      await new Promise((r) => mgrSocket.on('connect', r));
      mgrSocket.emit('manager:join', { managerId: 'test-mgr' });
      mgrSocket.emit('manager:join_room', { roomId: rid });
      await new Promise((r) => setTimeout(r, 300));
      mgrSocket.emit('manager:close_room', { roomId: rid });
    }, roomId);

    // 위젯에 종료 메시지 + 상태 변경 확인
    await page.waitForFunction(
      () => {
        const sr = document.querySelector('#ya-chat-widget-host')?.shadowRoot;
        if (!sr) return false;
        const status = sr.querySelector('#status-text')?.textContent || '';
        return status.includes('종료');
      },
      { timeout: 5000 }
    );

    const disabled = await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#msg-input').disabled
    );
    expect(disabled).toBe(true);

    // sessionStorage 초기화 확인
    const rid = await getRoomId(page);
    expect(rid).toBeFalsy();
  });
});
