(function () {
  const scriptEl =
    document.currentScript ||
    (function () {
      const scripts = document.querySelectorAll('script[src*="chat-widget"]');
      return scripts[scripts.length - 1];
    })();

  const scriptSrc = scriptEl ? scriptEl.src : '';
  let SERVER_URL = 'http://localhost:3001';
  if (scriptSrc) {
    try {
      const url = new URL(scriptSrc);
      SERVER_URL = url.origin;
    } catch (_) {}
  }

  const MODE = scriptEl?.getAttribute('data-mode') || 'kiosk';
  const IS_QR_MODE = MODE === 'guest-qr';
  const IS_KIOSK = !IS_QR_MODE;

  const STORAGE_KEY = 'ya_chat_room_id';
  const CHECKOUT_KEY = 'ya_checkout_date';
  const ROOM_KEY = 'ya_qr_room';
  const KIOSK_LANG_KEY = 'ya_kiosk_lang';

  // ── 객실 구성 (QR 모드 전용) ─────────────────────────────────
  const ROOM_CONFIG = [
    { label:'B1',  dorm:true, beds:14 },
    { label:'201' }, { label:'202' }, { label:'203' }, { label:'204' },
    { label:'205', dorm:true, beds:6 },
    { label:'206', dorm:true, beds:4 },
    { label:'207' }, { label:'208' },
    { label:'301', dorm:true, beds:4 },
    { label:'302' }, { label:'303', dorm:true, beds:4 },
    { label:'304' }, { label:'305' }, { label:'306' },
    { label:'307' }, { label:'308' }, { label:'309' },
    { label:'401' }, { label:'402' }, { label:'403' },
  ];
  const VIRTUAL_KB_LANGS = ['zh', 'ja', 'ru', 'es'];

  // ── i18n ──────────────────────────────────────────────────────
  const WIDGET_TEXT = {
    ko: {
      statusAuto: '자동응답 중', statusWaiting: '매니저 연결 대기 중',
      statusActive: '매니저 상담 중', statusClosed: '대화가 종료되었습니다',
      placeholder: '메시지를 입력하세요...', welcome: '안녕하세요! 무엇을 도와드릴까요? 😊',
      escalateBtn: '👤 매니저와 연결하기', closeConfirm: '대화를 종료하시겠어요?',
      closedMsg: '대화를 종료했습니다.', closedByManager: '매니저가 대화를 종료했습니다.',
      closedByIdle: '장시간 활동이 없어 대화가 자동 종료되었습니다.',
      escalateRequest: '매니저 연결 요청을 보냈습니다. 잠시만 기다려 주세요.',
      kbSend: '전송', closeBtnLabel: '대화종료',
      closeConfirmYes: '확인', closeConfirmNo: '취소',
    },
    en: {
      statusAuto: 'Auto-reply', statusWaiting: 'Waiting for manager',
      statusActive: 'Chatting with manager', statusClosed: 'Chat ended',
      placeholder: 'Type a message...', welcome: 'Hello! How can we help you? 😊',
      escalateBtn: '👤 Connect to manager', closeConfirm: 'End this conversation?',
      closedMsg: 'Conversation ended.', closedByManager: 'Manager has ended the chat.',
      closedByIdle: 'Chat ended due to inactivity.',
      escalateRequest: 'Connecting to manager. Please wait.',
      kbSend: 'Send', closeBtnLabel: 'End Chat',
      closeConfirmYes: 'OK', closeConfirmNo: 'Cancel',
    },
    zh: {
      statusAuto: '自动回复中', statusWaiting: '等待客服',
      statusActive: '客服服务中', statusClosed: '对话已结束',
      placeholder: '请输入消息...', welcome: '您好！有什么可以帮助您？😊',
      escalateBtn: '👤 联系客服', closeConfirm: '确定结束对话？',
      closedMsg: '对话已结束。', closedByManager: '客服已结束对话。',
      closedByIdle: '长时间无活动，对话已自动结束。',
      escalateRequest: '正在联系客服，请稍候。',
      kbSend: '发送', closeBtnLabel: '结束对话',
      closeConfirmYes: '确定', closeConfirmNo: '取消',
    },
    ja: {
      statusAuto: '自動応答中', statusWaiting: 'スタッフ接続待ち',
      statusActive: 'スタッフ対応中', statusClosed: 'チャット終了',
      placeholder: 'メッセージを入力...', welcome: 'こんにちは！何かお手伝いできますか？😊',
      escalateBtn: '👤 スタッフに連絡', closeConfirm: 'チャットを終了しますか？',
      closedMsg: 'チャットを終了しました。', closedByManager: 'スタッフがチャットを終了しました。',
      closedByIdle: '長時間操作がなかったため、チャットが終了しました。',
      escalateRequest: 'スタッフに接続中です。しばらくお待ちください。',
      kbSend: '送信', closeBtnLabel: 'チャット終了',
      closeConfirmYes: 'OK', closeConfirmNo: 'キャンセル',
    },
    ru: {
      statusAuto: 'Автоответ', statusWaiting: 'Ожидание менеджера',
      statusActive: 'Чат с менеджером', statusClosed: 'Чат завершён',
      placeholder: 'Введите сообщение...', welcome: 'Здравствуйте! Чем можем помочь? 😊',
      escalateBtn: '👤 Связаться с менеджером', closeConfirm: 'Завершить чат?',
      closedMsg: 'Чат завершён.', closedByManager: 'Менеджер завершил чат.',
      closedByIdle: 'Чат завершён из-за неактивности.',
      escalateRequest: 'Подключение к менеджеру. Пожалуйста, подождите.',
      kbSend: 'Отправить', closeBtnLabel: 'Завершить',
      closeConfirmYes: 'Да', closeConfirmNo: 'Нет',
    },
    es: {
      statusAuto: 'Respuesta automática', statusWaiting: 'Esperando al gerente',
      statusActive: 'Chat con el gerente', statusClosed: 'Chat finalizado',
      placeholder: 'Escribe un mensaje...', welcome: '¡Hola! ¿En qué podemos ayudarte? 😊',
      escalateBtn: '👤 Conectar con gerente', closeConfirm: '¿Finalizar la conversación?',
      closedMsg: 'Conversación finalizada.', closedByManager: 'El gerente ha finalizado el chat.',
      closedByIdle: 'Chat finalizado por inactividad.',
      escalateRequest: 'Conectando con el gerente. Por favor espera.',
      kbSend: 'Enviar', closeBtnLabel: 'Finalizar',
      closeConfirmYes: 'Sí', closeConfirmNo: 'Cancelar',
    },
  };

  // ── 키보드 레이아웃 ───────────────────────────────────────────
  const KB_LAYOUTS = {
    ru: [
      ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З','Х','Ъ'],
      ['Ф','Ы','В','А','П','Р','О','Л','Д','Ж','Э'],
      ['Я','Ч','С','М','И','Т','Ь','Б','Ю','.'],
    ],
    es: [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['Z','X','C','V','B','N','M'],
      ['á','é','í','ó','ú','ñ','ü','¡','¿'],
    ],
    zh: [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['Z','X','C','V','B','N','M'],
    ],
    ja: [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['Z','X','C','V','B','N','M'],
    ],
  };

  // ── 로마자→히라가나 변환표 ────────────────────────────────────
  const ROMAJI_TABLE = {
    sha:'しゃ', shi:'し', shu:'しゅ', she:'しぇ', sho:'しょ',
    chi:'ち', cha:'ちゃ', chu:'ちゅ', che:'ちぇ', cho:'ちょ',
    tsu:'つ', thi:'てぃ',
    kya:'きゃ', kyu:'きゅ', kyo:'きょ',
    nya:'にゃ', nyu:'にゅ', nyo:'にょ',
    mya:'みゃ', myu:'みゅ', myo:'みょ',
    hya:'ひゃ', hyu:'ひゅ', hyo:'ひょ',
    rya:'りゃ', ryu:'りゅ', ryo:'りょ',
    gya:'ぎゃ', gyu:'ぎゅ', gyo:'ぎょ',
    bya:'びゃ', byu:'びゅ', byo:'びょ',
    pya:'ぴゃ', pyu:'ぴゅ', pyo:'ぴょ',
    zya:'じゃ', zyu:'じゅ', zyo:'じょ',
    jya:'じゃ', jyu:'じゅ', jyo:'じょ',
    ka:'か', ki:'き', ku:'く', ke:'け', ko:'こ',
    sa:'さ', si:'し', su:'す', se:'せ', so:'そ',
    ta:'た', ti:'ち', tu:'つ', te:'て', to:'と',
    na:'な', ni:'に', nu:'ぬ', ne:'ね', no:'の',
    ha:'は', hi:'ひ', hu:'ふ', he:'へ', ho:'ほ',
    ma:'ま', mi:'み', mu:'む', me:'め', mo:'も',
    ya:'や', yu:'ゆ', yo:'よ',
    ra:'ら', ri:'り', ru:'る', re:'れ', ro:'ろ',
    wa:'わ', wo:'を',
    ga:'が', gi:'ぎ', gu:'ぐ', ge:'げ', go:'ご',
    za:'ざ', zi:'じ', zu:'ず', ze:'ぜ', zo:'ぞ',
    da:'だ', di:'ぢ', du:'づ', de:'で', do:'ど',
    ba:'ば', bi:'び', bu:'ぶ', be:'べ', bo:'ぼ',
    pa:'ぱ', pi:'ぴ', pu:'ぷ', pe:'ぺ', po:'ぽ',
    fa:'ふぁ', fi:'ふぃ', fu:'ふ', fe:'ふぇ', fo:'ふぉ',
    ja:'じゃ', ji:'じ', ju:'じゅ', je:'じぇ', jo:'じょ',
    a:'あ', i:'い', u:'う', e:'え', o:'お', n:'ん',
  };

  function convertRomaji(str) {
    let result = '';
    let i = 0;
    while (i < str.length) {
      let matched = false;
      for (let len = 3; len >= 1; len--) {
        const chunk = str.slice(i, i + len);
        if (ROMAJI_TABLE[chunk]) {
          result += ROMAJI_TABLE[chunk];
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) { result += str[i]; i++; }
    }
    return result;
  }

  const STATUS_COLOR = {
    auto: '#60a5fa', waiting: '#facc15', active: '#4ade80', closed: '#9ca3af',
  };

  // ── Shadow DOM 생성 ──────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'ya-chat-widget-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // ── CSS ──────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }

    #toggle-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #2563eb; color: white; border: none;
      font-size: 24px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    #toggle-btn:hover { background: #1d4ed8; }

    #chat-box {
      position: fixed; bottom: 92px; right: 24px; z-index: 9998;
      width: 340px; height: 480px;
      background: white; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: flex; flex-direction: column; overflow: hidden;
      transition: opacity 0.2s, transform 0.2s, height 0.2s, bottom 0.2s;
    }
    #chat-box.hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }
    #chat-box.kb-open { height: 700px; bottom: 20px; }

    #chat-header {
      background: #2563eb; color: white;
      padding: 12px 14px; font-weight: bold; font-size: 15px;
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    #status-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #86efac;
      flex-shrink: 0;
    }
    #title-wrap { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    #title { font-size: 14px; }
    #status-text { font-size: 11px; font-weight: normal; opacity: 0.9; }
    #close-btn {
      background: transparent; border: 1px solid rgba(255,255,255,0.55);
      color: white; font-size: 12px; font-weight: 600;
      cursor: pointer; padding: 4px 10px; border-radius: 6px;
      white-space: nowrap; flex-shrink: 0;
    }
    #close-btn:hover { background: rgba(255,255,255,0.18); }

    #close-confirm {
      position: absolute; inset: 0; background: rgba(255,255,255,0.97);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 20px; z-index: 20; border-radius: 16px;
    }
    #close-confirm.hidden { display: none; }
    #close-confirm p { font-size: 16px; color: #1e293b; font-weight: 500; text-align: center; }
    .confirm-btns { display: flex; gap: 12px; }
    #confirm-yes {
      padding: 10px 28px; border-radius: 10px; border: none;
      background: #2563eb; color: white; font-size: 15px; font-weight: 600; cursor: pointer;
    }
    #confirm-yes:hover { background: #1d4ed8; }
    #confirm-no {
      padding: 10px 28px; border-radius: 10px;
      border: 1px solid #e2e8f0; background: #f1f5f9;
      color: #475569; font-size: 15px; font-weight: 600; cursor: pointer;
    }
    #confirm-no:hover { background: #e2e8f0; }

    #lang-bar {
      display: flex; flex-wrap: wrap; gap: 4px;
      padding: 6px 10px; border-bottom: 1px solid #e2e8f0;
      background: #f8fafc; flex-shrink: 0;
    }
    .lang-btn {
      padding: 3px 8px; border-radius: 12px;
      border: 1px solid #cbd5e1; background: white;
      font-size: 12px; cursor: pointer; color: #475569;
      transition: background 0.15s;
    }
    .lang-btn.active { background: #2563eb; color: white; border-color: #2563eb; }
    .lang-btn:hover:not(.active) { background: #f1f5f9; }

    #messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }

    .msg {
      max-width: 80%; padding: 8px 12px; border-radius: 12px;
      font-size: 14px; line-height: 1.4; word-break: break-word;
    }
    .msg.guest   { align-self: flex-end; background: #2563eb; color: white; border-bottom-right-radius: 4px; }
    .msg.auto    { align-self: flex-start; background: #f1f5f9; color: #334155; border-bottom-left-radius: 4px; }
    .msg.manager { align-self: flex-start; background: #dcfce7; color: #166534; border-bottom-left-radius: 4px; }
    .msg.system  { align-self: center; background: #fef9c3; color: #713f12; font-size: 12px; padding: 4px 10px; border-radius: 20px; }

    #candidates-box {
      padding: 0 12px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .candidate-btn {
      background: #eff6ff; border: 1px solid #bfdbfe;
      border-radius: 8px; padding: 6px 10px;
      font-size: 13px; color: #1e40af; cursor: pointer; text-align: left;
    }
    .candidate-btn:hover { background: #dbeafe; }

    #escalate-btn {
      margin: 0 12px 10px; flex-shrink: 0;
      padding: 10px; border-radius: 10px;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #991b1b; font-size: 13px; cursor: pointer;
      display: none;
    }
    #escalate-btn.visible { display: block; }

    #virtual-kb {
      border-top: 1px solid #e2e8f0; background: #f1f5f9;
      padding: 6px 6px 4px; flex-shrink: 0;
    }
    #virtual-kb.hidden { display: none; }

    #vk-candidates {
      display: flex; flex-wrap: wrap; gap: 4px;
      margin-bottom: 5px; min-height: 0;
    }
    .vk-cand-char {
      padding: 3px 8px; background: white;
      border: 1px solid #93c5fd; border-radius: 6px;
      font-size: 16px; cursor: pointer; color: #1e293b;
      transition: background 0.1s;
    }
    .vk-cand-char:hover { background: #dbeafe; }
    .vk-cand-preview {
      font-size: 12px; color: #94a3b8;
      padding: 3px 6px; align-self: center;
    }

    #kb-rows { display: flex; flex-direction: column; gap: 3px; }
    .kb-row { display: flex; justify-content: center; gap: 2px; }
    .kb-key {
      min-width: 26px; height: 38px; padding: 0 3px;
      border: 1px solid #cbd5e1; border-radius: 5px;
      background: white; font-size: 14px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #1e293b; user-select: none; flex: 1; max-width: 36px;
    }
    .kb-key:active { background: #bfdbfe; }

    #kb-actions {
      display: flex; gap: 4px; margin-top: 4px;
    }
    #kb-space {
      flex: 1; height: 34px; border-radius: 6px;
      border: 1px solid #cbd5e1; background: white;
      font-size: 12px; cursor: pointer; color: #475569;
    }
    #kb-back {
      width: 48px; height: 34px; border-radius: 6px;
      border: 1px solid #cbd5e1; background: white;
      font-size: 16px; cursor: pointer; color: #ef4444;
    }
    #kb-send {
      width: 64px; height: 34px; border-radius: 6px;
      border: none; background: #2563eb; color: white;
      font-size: 12px; cursor: pointer; font-weight: 600;
    }
    #kb-space:active, #kb-back:active { background: #f1f5f9; }
    #kb-send:active { background: #1d4ed8; }

    #input-area {
      padding: 10px 12px; border-top: 1px solid #e2e8f0;
      display: flex; gap: 8px; flex-shrink: 0;
    }
    #msg-input {
      flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0;
      border-radius: 20px; font-size: 14px; outline: none;
    }
    #msg-input:focus { border-color: #2563eb; }
    #msg-input:disabled { background: #f3f4f6; cursor: not-allowed; }
    #send-btn {
      width: 36px; height: 36px; border-radius: 50%;
      background: #2563eb; color: white; border: none;
      font-size: 16px; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
    }
    #send-btn:hover { background: #1d4ed8; }
    #send-btn:disabled { background: #9ca3af; cursor: not-allowed; }

    #checkout-gate {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px 20px; gap: 16px; text-align: center;
    }
    #checkout-gate.hidden { display: none; }
    #checkout-gate p { font-size: 15px; color: #334155; line-height: 1.5; }
    #checkout-date {
      width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0;
      border-radius: 10px; font-size: 15px; outline: none; color: #1e293b;
    }
    #checkout-date:focus { border-color: #2563eb; }
    #checkout-submit {
      width: 100%; padding: 11px; border-radius: 10px;
      background: #2563eb; color: white; border: none;
      font-size: 15px; font-weight: 600; cursor: pointer;
    }
    #checkout-submit:hover { background: #1d4ed8; }
    #checkout-blocked {
      font-size: 13px; color: #ef4444; margin-top: 4px;
    }
    #checkout-blocked.hidden { display: none; }

    #room-gate {
      flex: 1; display: flex; flex-direction: column;
      padding: 16px 16px 8px; gap: 10px; overflow-y: auto;
    }
    #room-gate.hidden { display: none; }
    #room-gate > p { font-size: 15px; font-weight: 600; color: #334155; text-align: center; margin-bottom: 4px; }
    .floor-label {
      width: 100%; font-size: 11px; font-weight: 700; color: #94a3b8;
      letter-spacing: 0.05em; text-transform: uppercase; margin-top: 6px;
    }
    #room-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    #bed-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    #bed-grid.hidden { display: none; }
    #bed-grid > p { font-size: 13px; color: #475569; font-weight: 600; }
    #bed-btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .room-btn, .bed-btn {
      padding: 9px 14px; border-radius: 10px; border: 1.5px solid #e2e8f0;
      background: white; color: #1e293b; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: border-color 0.15s, background 0.15s;
    }
    .room-btn:hover, .bed-btn:hover { border-color: #2563eb; background: #eff6ff; color: #2563eb; }
  `;

  // ── HTML ──────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="toggle-btn" aria-label="채팅 열기">💬</button>
    <div id="chat-box" class="hidden">
      <div id="chat-header">
        <div id="status-dot"></div>
        <div id="title-wrap">
          <span id="title">야코리아 호스텔 채팅</span>
          <span id="status-text">${WIDGET_TEXT.ko.statusAuto}</span>
        </div>
        <button id="close-btn">${WIDGET_TEXT.ko.closeBtnLabel}</button>
      </div>
      <div id="close-confirm" class="hidden">
        <p>${WIDGET_TEXT.ko.closeConfirm}</p>
        <div class="confirm-btns">
          <button id="confirm-yes">${WIDGET_TEXT.ko.closeConfirmYes}</button>
          <button id="confirm-no">${WIDGET_TEXT.ko.closeConfirmNo}</button>
        </div>
      </div>
      ${IS_KIOSK ? `
      <div id="lang-bar">
        <button class="lang-btn" data-lang="ko">한국어</button>
        <button class="lang-btn" data-lang="en">EN</button>
        <button class="lang-btn" data-lang="zh">中文</button>
        <button class="lang-btn" data-lang="ja">日本語</button>
        <button class="lang-btn" data-lang="ru">RU</button>
        <button class="lang-btn" data-lang="es">ES</button>
      </div>` : ''}
      <div id="checkout-gate" class="hidden">
        <p>체크아웃 날짜를 입력해주세요</p>
        <input id="checkout-date" type="date" />
        <button id="checkout-submit">다음 →</button>
        <p id="checkout-blocked" class="hidden">체크아웃 이후에는 채팅을 이용하실 수 없습니다.</p>
      </div>
      ${IS_QR_MODE ? `
      <div id="room-gate" class="hidden">
        <p>방 번호를 선택해주세요</p>
        <div id="room-grid"></div>
        <div id="bed-grid" class="hidden">
          <p>침대 번호를 선택해주세요</p>
          <div id="bed-btns"></div>
        </div>
      </div>` : ''}
      <div id="messages"></div>
      <div id="candidates-box"></div>
      <button id="escalate-btn">${WIDGET_TEXT.ko.escalateBtn}</button>
      ${IS_KIOSK ? `
      <div id="virtual-kb" class="hidden">
        <div id="vk-candidates"></div>
        <div id="kb-rows"></div>
        <div id="kb-actions">
          <button id="kb-space">SPACE</button>
          <button id="kb-back">⌫</button>
          <button id="kb-send">${WIDGET_TEXT.ko.kbSend}</button>
        </div>
      </div>` : ''}
      <div id="input-area">
        <input id="msg-input" type="text" placeholder="${WIDGET_TEXT.ko.placeholder}" />
        <button id="send-btn">➤</button>
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  // ── 요소 참조 ─────────────────────────────────────────────────
  const toggleBtn       = shadow.getElementById('toggle-btn');
  const chatBox         = shadow.getElementById('chat-box');
  const statusDot       = shadow.getElementById('status-dot');
  const statusText      = shadow.getElementById('status-text');
  const closeBtn        = shadow.getElementById('close-btn');
  const messagesEl      = shadow.getElementById('messages');
  const candidatesBox   = shadow.getElementById('candidates-box');
  const escalateBtn     = shadow.getElementById('escalate-btn');
  const msgInput        = shadow.getElementById('msg-input');
  const sendBtn         = shadow.getElementById('send-btn');
  const checkoutGate    = shadow.getElementById('checkout-gate');
  const checkoutDate    = shadow.getElementById('checkout-date');
  const checkoutSubmit  = shadow.getElementById('checkout-submit');
  const checkoutBlocked = shadow.getElementById('checkout-blocked');
  const roomGate        = IS_QR_MODE ? shadow.getElementById('room-gate') : null;
  const roomGrid        = IS_QR_MODE ? shadow.getElementById('room-grid') : null;
  const bedGrid         = IS_QR_MODE ? shadow.getElementById('bed-grid') : null;
  const bedBtns         = IS_QR_MODE ? shadow.getElementById('bed-btns') : null;
  const titleEl         = shadow.getElementById('title');
  const inputArea       = shadow.getElementById('input-area');
  const closeConfirmEl  = shadow.getElementById('close-confirm');
  const confirmYesBtn   = shadow.getElementById('confirm-yes');
  const confirmNoBtn    = shadow.getElementById('confirm-no');
  const virtualKb       = IS_KIOSK ? shadow.getElementById('virtual-kb') : null;
  const vkCandidates    = IS_KIOSK ? shadow.getElementById('vk-candidates') : null;
  const kbSpace         = IS_KIOSK ? shadow.getElementById('kb-space') : null;
  const kbBack          = IS_KIOSK ? shadow.getElementById('kb-back') : null;
  const kbSend          = IS_KIOSK ? shadow.getElementById('kb-send') : null;

  let isOpen = false;
  let roomId = sessionStorage.getItem(STORAGE_KEY) || null;
  let socket = null;
  let connected = false;
  let currentStatus = 'auto';
  let currentLang = IS_KIOSK ? (sessionStorage.getItem(KIOSK_LANG_KEY) || 'ko') : 'ko';
  let pinyinBuffer = '';
  let romajiBuffer = '';

  // ── i18n 헬퍼 ────────────────────────────────────────────────
  function t(key) {
    return (WIDGET_TEXT[currentLang] || WIDGET_TEXT.ko)[key] || '';
  }

  // ── KST 날짜 유틸 ─────────────────────────────────────────────
  function getTodayKST() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const kst = new Date(utc + 9 * 60 * 60000);
    return kst.toISOString().slice(0, 10);
  }

  function isCheckoutExpired(dateStr) {
    return dateStr < getTodayKST();
  }

  // ── 체크아웃 게이트 (QR 모드 전용) ───────────────────────────
  function showCheckoutGate() {
    checkoutGate.classList.remove('hidden');
    messagesEl.style.display = 'none';
    candidatesBox.style.display = 'none';
    escalateBtn.style.display = 'none';
    inputArea.style.display = 'none';
    checkoutBlocked.classList.add('hidden');
    const today = getTodayKST();
    checkoutDate.min = today;
    checkoutDate.value = sessionStorage.getItem(CHECKOUT_KEY) || '';
  }

  function hideCheckoutGate() {
    checkoutGate.classList.add('hidden');
    messagesEl.style.display = '';
    candidatesBox.style.display = '';
    escalateBtn.style.display = '';
    inputArea.style.display = '';
  }

  function handleCheckoutSubmit() {
    const val = checkoutDate.value;
    if (!val) return;
    if (isCheckoutExpired(val)) {
      checkoutBlocked.classList.remove('hidden');
      return;
    }
    sessionStorage.setItem(CHECKOUT_KEY, val);
    hideCheckoutGate();
    showRoomGate();
  }

  if (checkoutSubmit) {
    checkoutSubmit.addEventListener('click', handleCheckoutSubmit);
    checkoutDate.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleCheckoutSubmit(); });
  }

  // ── 방 번호 게이트 (QR 모드 전용) ────────────────────────────
  function showRoomGate() {
    if (!roomGate) return;
    messagesEl.style.display = 'none';
    candidatesBox.style.display = 'none';
    escalateBtn.style.display = 'none';
    inputArea.style.display = 'none';
    roomGate.classList.remove('hidden');
    bedGrid.classList.add('hidden');

    // 층별로 방 버튼 렌더링
    roomGrid.innerHTML = '';
    const floors = [
      { name: 'B1F', filter: r => r.label === 'B1' },
      { name: '2F',  filter: r => r.label.startsWith('2') },
      { name: '3F',  filter: r => r.label.startsWith('3') },
      { name: '4F',  filter: r => r.label.startsWith('4') },
    ];
    floors.forEach(({ name, filter }) => {
      const rooms = ROOM_CONFIG.filter(filter);
      if (!rooms.length) return;
      const lbl = document.createElement('div');
      lbl.className = 'floor-label';
      lbl.textContent = name;
      roomGrid.appendChild(lbl);
      rooms.forEach(room => {
        const btn = document.createElement('button');
        btn.className = 'room-btn';
        btn.textContent = room.dorm ? `${room.label} 🛏` : room.label;
        btn.addEventListener('click', () => {
          if (room.dorm) showBedGrid(room);
          else finishRoomGate(room.label);
        });
        roomGrid.appendChild(btn);
      });
    });
  }

  function showBedGrid(room) {
    bedGrid.classList.remove('hidden');
    bedBtns.innerHTML = '';
    for (let i = 1; i <= room.beds; i++) {
      const btn = document.createElement('button');
      btn.className = 'bed-btn';
      btn.textContent = `${i}번`;
      btn.addEventListener('click', () => finishRoomGate(room.label + '-' + i));
      bedBtns.appendChild(btn);
    }
    bedGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideRoomGate() {
    if (!roomGate) return;
    roomGate.classList.add('hidden');
    messagesEl.style.display = '';
    candidatesBox.style.display = '';
    escalateBtn.style.display = '';
    inputArea.style.display = '';
  }

  function finishRoomGate(label) {
    sessionStorage.setItem(ROOM_KEY, label);
    hideRoomGate();
    if (!connected) connectSocket();
    else if (!roomId) socket.emit('guest:join', { guestId: getGuestId(), roomLabel: label });
  }

  // ── 가상 키보드 ───────────────────────────────────────────────
  function loadPinyinDict(cb) {
    if (window.PINYIN_DICT) return cb();
    const s = document.createElement('script');
    s.src = `${SERVER_URL}/widget/pinyin-dict.js`;
    s.onload = cb;
    s.onerror = () => { console.warn('pinyin-dict.js load failed'); cb(); };
    document.head.appendChild(s);
  }

  function renderKeyboard(lang) {
    const kbRows = shadow.getElementById('kb-rows');
    kbRows.innerHTML = '';
    const layout = KB_LAYOUTS[lang];
    if (!layout) return;
    layout.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'kb-key';
        btn.textContent = key;
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          handleKeyPress(key, lang);
        });
        rowEl.appendChild(btn);
      });
      kbRows.appendChild(rowEl);
    });
  }

  function handleKeyPress(key, lang) {
    if (lang === 'ru') {
      msgInput.value += key.toLowerCase();
    } else if (lang === 'es') {
      // QWERTY row: lowercase; special chars: already lowercase/correct
      msgInput.value += /^[A-Z]$/.test(key) ? key.toLowerCase() : key;
    } else if (lang === 'zh') {
      if (/^[A-Z]$/.test(key)) {
        pinyinBuffer += key.toLowerCase();
        updateZhCandidates();
      } else {
        msgInput.value += key;
      }
    } else if (lang === 'ja') {
      if (/^[A-Z]$/.test(key)) {
        romajiBuffer += key.toLowerCase();
        updateJaCandidates();
      } else {
        msgInput.value += key;
      }
    }
  }

  function updateZhCandidates() {
    if (!vkCandidates) return;
    vkCandidates.innerHTML = '';
    if (!pinyinBuffer) return;

    const preview = document.createElement('span');
    preview.className = 'vk-cand-preview';
    preview.textContent = pinyinBuffer;
    vkCandidates.appendChild(preview);

    const candidates = window.PINYIN_DICT && window.PINYIN_DICT[pinyinBuffer.toLowerCase()];
    if (candidates) {
      candidates.slice(0, 8).forEach(char => {
        const btn = document.createElement('button');
        btn.className = 'vk-cand-char';
        btn.textContent = char;
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          msgInput.value += char;
          pinyinBuffer = '';
          updateZhCandidates();
        });
        vkCandidates.appendChild(btn);
      });
    }
  }

  function updateJaCandidates() {
    if (!vkCandidates) return;
    vkCandidates.innerHTML = '';
    if (!romajiBuffer) return;

    const hiragana = convertRomaji(romajiBuffer.toLowerCase());
    const btn = document.createElement('button');
    btn.className = 'vk-cand-char';
    btn.textContent = hiragana;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      msgInput.value += hiragana;
      romajiBuffer = '';
      updateJaCandidates();
    });
    vkCandidates.appendChild(btn);

    const preview = document.createElement('span');
    preview.className = 'vk-cand-preview';
    preview.textContent = `(${romajiBuffer})`;
    vkCandidates.appendChild(preview);
  }

  function flushBuffers() {
    if (currentLang === 'zh' && pinyinBuffer) {
      const candidates = window.PINYIN_DICT && window.PINYIN_DICT[pinyinBuffer.toLowerCase()];
      msgInput.value += (candidates && candidates[0]) || pinyinBuffer;
      pinyinBuffer = '';
      if (vkCandidates) vkCandidates.innerHTML = '';
    }
    if (currentLang === 'ja' && romajiBuffer) {
      msgInput.value += convertRomaji(romajiBuffer.toLowerCase());
      romajiBuffer = '';
      if (vkCandidates) vkCandidates.innerHTML = '';
    }
  }

  function applyLangToUI() {
    const labels = {
      auto: t('statusAuto'), waiting: t('statusWaiting'),
      active: t('statusActive'), closed: t('statusClosed'),
    };
    statusText.textContent = labels[currentStatus] || t('statusAuto');
    escalateBtn.textContent = t('escalateBtn');
    closeBtn.textContent = t('closeBtnLabel');
    confirmYesBtn.textContent = t('closeConfirmYes');
    confirmNoBtn.textContent = t('closeConfirmNo');
    closeConfirmEl.querySelector('p').textContent = t('closeConfirm');
    const isClosed = currentStatus === 'closed';
    msgInput.placeholder = isClosed ? t('statusClosed') : t('placeholder');
    if (kbSend) kbSend.textContent = t('kbSend');
  }

  function switchLang(lang) {
    currentLang = lang;
    sessionStorage.setItem(KIOSK_LANG_KEY, lang);

    shadow.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    pinyinBuffer = '';
    romajiBuffer = '';
    if (vkCandidates) vkCandidates.innerHTML = '';

    applyLangToUI();

    const needsVK = VIRTUAL_KB_LANGS.includes(lang);
    if (needsVK) {
      if (lang === 'zh') {
        loadPinyinDict(() => renderKeyboard(lang));
      } else {
        renderKeyboard(lang);
      }
      virtualKb.classList.remove('hidden');
      chatBox.classList.add('kb-open');
      msgInput.setAttribute('inputmode', 'none');
    } else {
      virtualKb.classList.add('hidden');
      chatBox.classList.remove('kb-open');
      msgInput.removeAttribute('inputmode');
      if (isOpen) msgInput.focus();
    }
  }

  // ── 가상 키보드 액션 버튼 ─────────────────────────────────────
  if (IS_KIOSK) {
    kbSpace.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      flushBuffers();
      msgInput.value += ' ';
    });

    kbBack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (currentLang === 'zh' && pinyinBuffer) {
        pinyinBuffer = pinyinBuffer.slice(0, -1);
        updateZhCandidates();
      } else if (currentLang === 'ja' && romajiBuffer) {
        romajiBuffer = romajiBuffer.slice(0, -1);
        updateJaCandidates();
      } else {
        msgInput.value = msgInput.value.slice(0, -1);
      }
    });

    kbSend.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      flushBuffers();
      sendMessage();
    });

    shadow.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => switchLang(btn.dataset.lang));
    });

    switchLang(currentLang);
  }

  // ── 상태 배지 갱신 ─────────────────────────────────────────────
  function updateStatus(status) {
    if (!status) return;
    currentStatus = status;
    const labels = {
      auto: t('statusAuto'), waiting: t('statusWaiting'),
      active: t('statusActive'), closed: t('statusClosed'),
    };
    statusText.textContent = labels[status] || status;
    statusDot.style.background = STATUS_COLOR[status] || '#86efac';
    const isClosed = status === 'closed';
    msgInput.disabled = isClosed;
    sendBtn.disabled = isClosed;
    msgInput.placeholder = isClosed ? t('statusClosed') : t('placeholder');
  }

  // ── 메시지 렌더링 ──────────────────────────────────────────────
  function appendMsg(text, type) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showCandidates(candidates) {
    candidatesBox.innerHTML = '';
    if (!candidates || candidates.length === 0) return;
    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:4px;padding:8px 0 0;';
    label.textContent = '혹시 이런 내용을 찾으시나요?';
    candidatesBox.appendChild(label);
    candidates.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'candidate-btn';
      btn.textContent = c.question;
      btn.onclick = () => {
        appendMsg(c.answer, 'auto');
        candidatesBox.innerHTML = '';
      };
      candidatesBox.appendChild(btn);
    });
  }

  // ── 세션 초기화 ────────────────────────────────────────────────
  function resetSession() {
    sessionStorage.removeItem(STORAGE_KEY);
    if (IS_QR_MODE) {
      sessionStorage.removeItem(CHECKOUT_KEY);
      sessionStorage.removeItem(ROOM_KEY);
      if (titleEl) titleEl.textContent = '야코리아 호스텔 채팅';
    }
    roomId = null;
    messagesEl.innerHTML = '';
    candidatesBox.innerHTML = '';
    escalateBtn.classList.remove('visible');
    currentStatus = 'auto';
    pinyinBuffer = '';
    romajiBuffer = '';
    if (vkCandidates) vkCandidates.innerHTML = '';
  }

  // ── Socket.IO 로드 & 연결 ──────────────────────────────────────
  function loadSocketIO(cb) {
    if (window.io) return cb();
    const s = document.createElement('script');
    s.src = `${SERVER_URL}/socket.io/socket.io.js`;
    s.onload = cb;
    document.head.appendChild(s);
  }

  function connectSocket() {
    if (connected) return;
    loadSocketIO(() => {
      socket = window.io(SERVER_URL, { transports: ['websocket'] });

      socket.on('connect', () => {
        connected = true;
        socket.emit('guest:join', {
          roomId,
          guestId: getGuestId(),
          roomLabel: sessionStorage.getItem(ROOM_KEY) || '',
        });
      });

      socket.on('room:created', ({ roomId: rid, status }) => {
        const isNewRoom = rid !== roomId;
        roomId = rid;
        sessionStorage.setItem(STORAGE_KEY, rid);
        updateStatus(status || 'auto');
        // QR 모드: 헤더에 방 번호 표시
        if (IS_QR_MODE && titleEl) {
          const lbl = sessionStorage.getItem(ROOM_KEY);
          if (lbl) titleEl.textContent = `야코리아 · ${lbl}호`;
        }
        if (isNewRoom && messagesEl.children.length === 0) {
          appendMsg(t('welcome'), 'system');
        }
      });

      socket.on('room:status', ({ status }) => {
        updateStatus(status);
      });

      socket.on('auto:response', ({ content }) => {
        candidatesBox.innerHTML = '';
        escalateBtn.classList.remove('visible');
        appendMsg(content, 'auto');
      });

      socket.on('auto:candidates', ({ candidates }) => {
        escalateBtn.classList.remove('visible');
        showCandidates(candidates);
      });

      socket.on('auto:escalate', () => {
        candidatesBox.innerHTML = '';
        escalateBtn.classList.add('visible');
        appendMsg('답변을 찾지 못했습니다. 매니저와 연결하시겠어요?', 'system');
      });

      socket.on('manager:message', ({ content }) => {
        appendMsg(content, 'manager');
      });

      socket.on('room:closed', ({ by }) => {
        if (currentStatus === 'closed') return;
        const msg =
          by === 'manager' ? t('closedByManager') :
          by === 'idle_timeout' ? t('closedByIdle') :
          t('closedMsg');
        appendMsg(msg, 'system');
        updateStatus('closed');
        sessionStorage.removeItem(STORAGE_KEY);
        roomId = null;
      });

      socket.on('disconnect', () => {
        connected = false;
      });
    });
  }

  function getGuestId() {
    let id = localStorage.getItem('ya_guest_id');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('ya_guest_id', id);
    }
    return id;
  }

  // ── 이벤트 ────────────────────────────────────────────────────
  toggleBtn.addEventListener('click', () => {
    if (isOpen === false && currentStatus === 'closed') {
      resetSession(); // CHECKOUT_KEY / ROOM_KEY 포함 QR 정리는 resetSession에서 처리
    }
    isOpen = !isOpen;
    chatBox.classList.toggle('hidden', !isOpen);
    toggleBtn.textContent = isOpen ? '✕' : '💬';
    if (!isOpen) hideCloseConfirm();

    if (isOpen) {
      if (IS_QR_MODE) {
        const savedDate = sessionStorage.getItem(CHECKOUT_KEY);
        if (!savedDate || isCheckoutExpired(savedDate)) {
          showCheckoutGate();
          return;
        }
        hideCheckoutGate();
        const savedRoom = sessionStorage.getItem(ROOM_KEY);
        if (!savedRoom) {
          showRoomGate();
          return;
        }
        hideRoomGate();
      } else if (IS_KIOSK) {
        switchLang(currentLang);
      }
      if (!connected) connectSocket();
      else if (!roomId) socket.emit('guest:join', { guestId: getGuestId(), roomLabel: sessionStorage.getItem(ROOM_KEY) || '' });
      if (!VIRTUAL_KB_LANGS.includes(currentLang)) msgInput.focus();
    }
  });

  function sendMessage() {
    flushBuffers();
    const content = msgInput.value.trim();
    if (!content || !roomId || currentStatus === 'closed') return;
    appendMsg(content, 'guest');
    socket.emit('guest:send_message', { roomId, content });
    msgInput.value = '';
    candidatesBox.innerHTML = '';
    escalateBtn.classList.remove('visible');
  }

  sendBtn.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  escalateBtn.addEventListener('click', () => {
    escalateBtn.classList.remove('visible');
    if (socket && roomId) socket.emit('guest:escalate', { roomId });
    appendMsg(t('escalateRequest'), 'system');
  });

  function showCloseConfirm() {
    closeConfirmEl.classList.remove('hidden');
  }
  function hideCloseConfirm() {
    closeConfirmEl.classList.add('hidden');
  }

  closeBtn.addEventListener('click', showCloseConfirm);

  confirmNoBtn.addEventListener('click', hideCloseConfirm);

  confirmYesBtn.addEventListener('click', () => {
    hideCloseConfirm();
    if (socket && roomId && currentStatus !== 'closed') {
      socket.emit('guest:close_room', { roomId });
    }
    appendMsg(t('closedMsg'), 'system');
    updateStatus('closed');
    sessionStorage.removeItem(STORAGE_KEY);
    roomId = null;
  });
})();
