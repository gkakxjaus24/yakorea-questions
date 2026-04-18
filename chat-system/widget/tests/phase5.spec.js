const { test, expect } = require('@playwright/test');

const TEST_PAGE = 'http://localhost:3001/widget/tests/test-page.html';

// Shadow DOM 내부 요소 접근 헬퍼
async function shadowEl(page, selector) {
  return page.evaluateHandle(
    (sel) => document.querySelector('#ya-chat-widget-host').shadowRoot.querySelector(sel),
    selector
  );
}

async function shadowText(page, selector) {
  return page.evaluate(
    (sel) =>
      document.querySelector('#ya-chat-widget-host').shadowRoot.querySelector(sel)?.textContent?.trim(),
    selector
  );
}

test.describe('Phase 5 — 채팅 위젯', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_PAGE);
    // 위젯 호스트 로딩 대기
    await page.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('#toggle-btn')
    );
  });

  test('1. 위젯 토글 버튼이 존재한다', async ({ page }) => {
    const btn = await shadowEl(page, '#toggle-btn');
    expect(btn).not.toBeNull();
  });

  test('2. 채팅창 열기/닫기', async ({ page }) => {
    // 처음에는 닫혀있음
    const isHidden = await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#chat-box').classList.contains('hidden')
    );
    expect(isHidden).toBe(true);

    // 열기
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#toggle-btn').click()
    );
    const isOpen = await page.evaluate(() =>
      !document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#chat-box').classList.contains('hidden')
    );
    expect(isOpen).toBe(true);

    // 닫기
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#toggle-btn').click()
    );
    const isClosed = await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#chat-box').classList.contains('hidden')
    );
    expect(isClosed).toBe(true);
  });

  test('3. 채팅창 열면 서버 연결 후 환영 메시지 표시', async ({ page }) => {
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#toggle-btn').click()
    );

    // room:created 이벤트 후 환영 메시지 대기 (최대 5초)
    await page.waitForFunction(
      () => {
        const msgs = document.querySelector('#ya-chat-widget-host')
          ?.shadowRoot?.querySelectorAll('.msg.system');
        return msgs && msgs.length > 0;
      },
      { timeout: 8000 }
    );

    const msgText = await page.evaluate(() => {
      const msgs = document.querySelector('#ya-chat-widget-host')
        .shadowRoot.querySelectorAll('.msg.system');
      return Array.from(msgs).map((m) => m.textContent);
    });
    expect(msgText.some((t) => t.includes('도와드릴까요'))).toBe(true);
  });

  test('4. 메시지 전송 → FAQ 자동응답 수신', async ({ page }) => {
    // 채팅창 열기 + 연결 대기
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#toggle-btn').click()
    );
    await page.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('.msg.system'),
      { timeout: 8000 }
    );

    // 메시지 입력 및 전송
    await page.evaluate(() => {
      const sr = document.querySelector('#ya-chat-widget-host').shadowRoot;
      const input = sr.querySelector('#msg-input');
      input.value = '체크인 시간이 언제인가요';
      sr.querySelector('#send-btn').click();
    });

    // guest 메시지 버블 확인
    await page.waitForFunction(
      () => document.querySelector('#ya-chat-widget-host')
        .shadowRoot.querySelector('.msg.guest') !== null,
      { timeout: 5000 }
    );

    // auto 응답 대기
    await page.waitForFunction(
      () => document.querySelector('#ya-chat-widget-host')
        .shadowRoot.querySelector('.msg.auto') !== null,
      { timeout: 8000 }
    );

    const autoMsg = await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host')
        .shadowRoot.querySelector('.msg.auto').textContent
    );
    expect(autoMsg).toContain('15:00');
  });

  test('5. 관련없는 질문 → escalate 버튼 표시', async ({ page }) => {
    await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host').shadowRoot
        .querySelector('#toggle-btn').click()
    );
    await page.waitForFunction(
      () => !!document.querySelector('#ya-chat-widget-host')?.shadowRoot?.querySelector('.msg.system'),
      { timeout: 8000 }
    );

    await page.evaluate(() => {
      const sr = document.querySelector('#ya-chat-widget-host').shadowRoot;
      sr.querySelector('#msg-input').value = 'qwerty asdfg zxcvb 무관한질문xyz';
      sr.querySelector('#send-btn').click()
    });

    await page.waitForFunction(
      () => document.querySelector('#ya-chat-widget-host')
        .shadowRoot.querySelector('#escalate-btn').classList.contains('visible'),
      { timeout: 8000 }
    );

    const btnVisible = await page.evaluate(() =>
      document.querySelector('#ya-chat-widget-host')
        .shadowRoot.querySelector('#escalate-btn').classList.contains('visible')
    );
    expect(btnVisible).toBe(true);
  });
});
