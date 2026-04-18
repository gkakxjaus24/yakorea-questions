(function () {
  // script src에서 서버 URL 자동 감지
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

  const STORAGE_KEY = 'ya_chat_room_id';

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
      transition: opacity 0.2s, transform 0.2s;
    }
    #chat-box.hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }

    #chat-header {
      background: #2563eb; color: white;
      padding: 14px 16px; font-weight: bold; font-size: 15px;
      display: flex; align-items: center; gap: 8px;
    }
    #status-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #86efac;
    }

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
      padding: 8px 12px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .candidate-btn {
      background: #eff6ff; border: 1px solid #bfdbfe;
      border-radius: 8px; padding: 6px 10px;
      font-size: 13px; color: #1e40af; cursor: pointer; text-align: left;
    }
    .candidate-btn:hover { background: #dbeafe; }

    #escalate-btn {
      margin: 0 12px 10px;
      padding: 10px; border-radius: 10px;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #991b1b; font-size: 13px; cursor: pointer;
      display: none;
    }
    #escalate-btn.visible { display: block; }

    #input-area {
      padding: 10px 12px; border-top: 1px solid #e2e8f0;
      display: flex; gap: 8px;
    }
    #msg-input {
      flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0;
      border-radius: 20px; font-size: 14px; outline: none;
    }
    #msg-input:focus { border-color: #2563eb; }
    #send-btn {
      width: 36px; height: 36px; border-radius: 50%;
      background: #2563eb; color: white; border: none;
      font-size: 16px; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
    }
    #send-btn:hover { background: #1d4ed8; }
  `;

  // ── HTML ──────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="toggle-btn" aria-label="채팅 열기">💬</button>
    <div id="chat-box" class="hidden">
      <div id="chat-header">
        <div id="status-dot"></div>
        <span>야코리아 호스텔 채팅</span>
      </div>
      <div id="messages"></div>
      <div id="candidates-box"></div>
      <button id="escalate-btn">👤 매니저와 연결하기</button>
      <div id="input-area">
        <input id="msg-input" type="text" placeholder="메시지를 입력하세요..." />
        <button id="send-btn">➤</button>
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  // ── 요소 참조 ─────────────────────────────────────────────────
  const toggleBtn     = shadow.getElementById('toggle-btn');
  const chatBox       = shadow.getElementById('chat-box');
  const messagesEl    = shadow.getElementById('messages');
  const candidatesBox = shadow.getElementById('candidates-box');
  const escalateBtn   = shadow.getElementById('escalate-btn');
  const msgInput      = shadow.getElementById('msg-input');
  const sendBtn       = shadow.getElementById('send-btn');

  let isOpen = false;
  let roomId = sessionStorage.getItem(STORAGE_KEY) || null;
  let socket = null;
  let connected = false;

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
    label.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:4px;';
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
        // 재연결 시 기존 roomId로 재입장
        socket.emit('guest:join', { roomId, guestId: getGuestId() });
      });

      socket.on('room:created', ({ roomId: rid }) => {
        roomId = rid;
        sessionStorage.setItem(STORAGE_KEY, rid);
        if (messagesEl.children.length === 0) {
          appendMsg('안녕하세요! 무엇을 도와드릴까요? 😊', 'system');
        }
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
    isOpen = !isOpen;
    chatBox.classList.toggle('hidden', !isOpen);
    toggleBtn.textContent = isOpen ? '✕' : '💬';
    if (isOpen && !connected) connectSocket();
    if (isOpen) msgInput.focus();
  });

  function sendMessage() {
    const content = msgInput.value.trim();
    if (!content || !roomId) return;
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
    appendMsg('매니저 연결 요청을 보냈습니다. 잠시만 기다려 주세요.', 'system');
  });
})();
