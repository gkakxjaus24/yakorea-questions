const { test, expect } = require('@playwright/test');

const WIDGET_PAGE = 'http://localhost:3001/widget/tests/test-page.html';
const ADMIN_PAGE  = 'http://localhost:3000';

// Shadow DOM 헬퍼
function shadowQ(page, sel) {
  return page.evaluate(
    (s) => document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector(s)?.textContent?.trim(),
    sel
  );
}

async function waitShadow(page, sel, timeout = 8000) {
  await page.waitForFunction(
    (s) => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector(s),
    sel,
    { timeout }
  );
}

test.describe('Phase 6 — 관리자 페이지 E2E', () => {
  test('1. 관리자 페이지 로드 및 소켓 연결', async ({ page }) => {
    await page.goto(ADMIN_PAGE);
    await page.waitForSelector('text=야코리아 채팅 관리', { timeout: 10000 });
    // 연결 상태 표시
    await page.waitForFunction(
      () => document.body.textContent?.includes('연결됨'),
      { timeout: 10000 }
    );
    const text = await page.textContent('body');
    expect(text).toContain('야코리아 채팅 관리');
    expect(text).toContain('연결됨');
  });

  test('2. 위젯 손님 메시지 → 관리자 페이지 수신 (히스토리)', async ({ browser }) => {
    const adminCtx  = await browser.newContext();
    const guestCtx  = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    const guestPage = await guestCtx.newPage();

    // 1) 위젯 열기 + 방 생성
    await guestPage.goto(WIDGET_PAGE);
    await waitShadow(guestPage, '#toggle-btn');
    await guestPage.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot.querySelector('#toggle-btn').click()
    );
    await waitShadow(guestPage, '.msg.system');

    const roomId = await guestPage.evaluate(() => sessionStorage.getItem('ya_chat_room_id'));
    expect(roomId).toBeTruthy();

    // 2) 손님: 먼저 메시지 전송 (DB에 저장됨)
    await guestPage.evaluate(() => {
      const sr = document.querySelector('#ya-chat-widget-host').shadowRoot;
      sr.querySelector('#msg-input').value = '체크인 시간이 언제인가요';
      sr.querySelector('#send-btn').click();
    });
    // 메시지 DB 저장 대기
    await guestPage.waitForTimeout(1000);

    // 3) 관리자: 방 입장 → room:history로 수신
    await adminPage.goto(`${ADMIN_PAGE}/chat/${roomId}`);
    await adminPage.waitForFunction(
      () => document.body.textContent?.includes('연결됨'),
      { timeout: 10000 }
    );

    // 4) 관리자: 히스토리에서 손님 메시지 확인
    await adminPage.waitForFunction(
      () => document.body.textContent?.includes('체크인 시간이 언제인가요'),
      { timeout: 10000 }
    );
    const adminText = await adminPage.textContent('body');
    expect(adminText).toContain('체크인 시간이 언제인가요');

    await adminCtx.close();
    await guestCtx.close();
  });

  test('3. 관리자 답장 → 위젯 손님 실시간 수신', async ({ browser }) => {
    const adminCtx  = await browser.newContext();
    const guestCtx  = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    const guestPage = await guestCtx.newPage();

    // 위젯 열기 + 방 생성
    await guestPage.goto(WIDGET_PAGE);
    await waitShadow(guestPage, '#toggle-btn');
    await guestPage.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot.querySelector('#toggle-btn').click()
    );
    await waitShadow(guestPage, '.msg.system');

    const roomId = await guestPage.evaluate(() => sessionStorage.getItem('ya_chat_room_id'));
    expect(roomId).toBeTruthy();

    // 관리자: 연결 + 방 입장
    await adminPage.goto(ADMIN_PAGE);
    await adminPage.waitForFunction(() => document.body.textContent?.includes('연결됨'), { timeout: 10000 });
    await adminPage.goto(`${ADMIN_PAGE}/chat/${roomId}`);
    await adminPage.waitForSelector('text=채팅방', { timeout: 10000 });

    // 관리자: 답장 전송
    await adminPage.fill('input[placeholder*="답장"]', '안녕하세요, 무엇을 도와드릴까요?');
    await adminPage.keyboard.press('Enter');

    // 손님: 매니저 메시지 수신 확인
    await guestPage.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('.msg.manager'),
      { timeout: 10000 }
    );
    const managerMsg = await guestPage.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot.querySelector('.msg.manager')?.textContent
    );
    expect(managerMsg).toContain('안녕하세요');

    await adminCtx.close();
    await guestCtx.close();
  });
});
