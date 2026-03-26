// ============================================================
// 야코리아 채팅 위젯 V2 (chat-widget.js)
// ============================================================
// 숙소 홈페이지에 아래 한 줄을 추가하면 채팅 버튼이 생깁니다:
//   <script src="http://localhost:3001/widget/chat-widget.js"></script>
//
// 주요 특징:
//   - Shadow DOM으로 기존 페이지 CSS와 완전 격리
//   - Socket.IO로 서버와 실시간 통신
//   - 다국어 가상 키보드 내장 (한국어/영어/일본어/중국어)
//   - 자동응답 + 매니저 연결 흐름 지원
//   - 모바일 반응형 레이아웃
// ============================================================

(function () {
    'use strict';

    // ========== 서버 주소 자동 감지 ==========
    // 이 스크립트 파일이 로드된 URL에서 서버 주소를 추출합니다.
    // 예: http://localhost:3001/widget/chat-widget.js → SERVER_URL = http://localhost:3001
    const SCRIPT_TAG = document.currentScript;
    const SERVER_URL = SCRIPT_TAG
        ? new URL(SCRIPT_TAG.src).origin
        : 'http://localhost:3001';

    // ========== 다국어 텍스트 ==========
    const I18N = {
        ko: {
            title:             '야코리아 문의',
            placeholder:       '메시지를 입력하세요...',
            send:              '전송',
            manager_btn:       '👤 매니저와 대화하기',
            manager_requested: '✅ 매니저 연결 요청됨',
            manager_connected: '✅ 매니저가 연결되었습니다',
            auto_reply_label:  '🤖 자동응답',
            system_label:      '시스템',
            manager_label:     '👤 매니저',
            welcome:           '안녕하세요! 야코리아입니다.',
            close_chat:        '대화 종료 및 기록 삭제',
            confirm_close:     '대화 내용을 모두 삭제하고 종료하시겠습니까?',
            keyboard_btn:      '⌨️ 키보드',
            lang_ko:           '한국어',
            lang_en:           'English',
            lang_zh:           '中文',
            lang_ja:           '日本語'
        },
        en: {
            title:             'Yakorea Support',
            placeholder:       'Type your message...',
            send:              'Send',
            manager_btn:       '👤 Talk to Manager',
            manager_requested: '✅ Manager connection requested',
            manager_connected: '✅ Manager has connected',
            auto_reply_label:  '🤖 Auto-reply',
            system_label:      'System',
            manager_label:     '👤 Manager',
            welcome:           'Hello! Welcome to Yakorea.',
            close_chat:        'End Chat & Clear History',
            confirm_close:     'Are you sure you want to end the chat?',
            keyboard_btn:      '⌨️ Keyboard',
            lang_ko:           '한국어',
            lang_en:           'English',
            lang_zh:           '中文',
            lang_ja:           '日本語'
        },
        zh: {
            title:             'Yakorea 咨询',
            placeholder:       '请输入消息...',
            send:              '发送',
            manager_btn:       '👤 联系管理人员',
            manager_requested: '✅ 已请求管理人员连接',
            manager_connected: '✅ 管理人员已连接',
            auto_reply_label:  '🤖 自动回复',
            system_label:      '系统',
            manager_label:     '👤 管理人员',
            welcome:           '您好！欢迎来到Yakorea。',
            close_chat:        '结束对话并清除记录',
            confirm_close:     '您确定要结束对话吗？',
            keyboard_btn:      '⌨️ 键盘',
            lang_ko:           '한국어',
            lang_en:           'English',
            lang_zh:           '中文',
            lang_ja:           '日本語'
        },
        ja: {
            title:             'Yakorea お問い合わせ',
            placeholder:       'メッセージを入力...',
            send:              '送信',
            manager_btn:       '👤 マネージャーと話す',
            manager_requested: '✅ マネージャー接続リクエスト済み',
            manager_connected: '✅ マネージャーが接続しました',
            auto_reply_label:  '🤖 自動応答',
            system_label:      'システム',
            manager_label:     '👤 マネージャー',
            welcome:           'こんにちは！Yakoreaへようこそ。',
            close_chat:        '対話を終了して記録を削除',
            confirm_close:     '対話を終了してもよろしいですか？',
            keyboard_btn:      '⌨️ キーボード',
            lang_ko:           '한국어',
            lang_en:           'English',
            lang_zh:           '中文',
            lang_ja:           '日本語'
        }
    };

    // ========== 가상 키보드 레이아웃 정의 ==========
    // 각 언어별 키 배열. 특수키는 {label, value, cls, action} 객체로 표현
    const KB_LAYOUTS = {
        en: [
            ['q','w','e','r','t','y','u','i','o','p'],
            ['a','s','d','f','g','h','j','k','l'],
            [{label:'⇧', cls:'key-shift', action:'shift'},'z','x','c','v','b','n','m',{label:'⌫', cls:'key-del', action:'backspace'}],
            [{label:'123', cls:'key-num', action:'num'},{label:'Space', value:' ', cls:'key-space'},{label:'↵', cls:'key-enter', action:'enter'}]
        ],
        en_upper: [
            ['Q','W','E','R','T','Y','U','I','O','P'],
            ['A','S','D','F','G','H','J','K','L'],
            [{label:'⇩', cls:'key-shift key-active', action:'shift'},'Z','X','C','V','B','N','M',{label:'⌫', cls:'key-del', action:'backspace'}],
            [{label:'123', cls:'key-num', action:'num'},{label:'Space', value:' ', cls:'key-space'},{label:'↵', cls:'key-enter', action:'enter'}]
        ],
        num: [
            ['1','2','3','4','5','6','7','8','9','0'],
            ['!','@','#','$','%','^','&','*','(',')'],
            ['-','_','=','+','[',']','{','}','|',{label:'⌫', cls:'key-del', action:'backspace'}],
            [{label:'ABC', cls:'key-num', action:'alpha'},{label:'Space', value:' ', cls:'key-space'},{label:'↵', cls:'key-enter', action:'enter'}]
        ],
        ko: [
            // 한글 기본 자음/모음 (두벌식 기반, 실용적인 자모)
            ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],
            ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],
            ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ',{label:'⌫', cls:'key-del', action:'backspace'}],
            [{label:'123', cls:'key-num', action:'num'},{label:'Space', value:' ', cls:'key-space'},{label:'↵', cls:'key-enter', action:'enter'}]
        ],
        zh: [
            // 중국어는 병음(Pinyin) 입력 방식으로 영문 키보드 사용
            ['q','w','e','r','t','y','u','i','o','p'],
            ['a','s','d','f','g','h','j','k','l'],
            [{label:'⇧', cls:'key-shift', action:'shift'},'z','x','c','v','b','n','m',{label:'⌫', cls:'key-del', action:'backspace'}],
            [{label:'123', cls:'key-num', action:'num'},{label:'Space', value:' ', cls:'key-space'},{label:'↵', cls:'key-enter', action:'enter'}]
        ],
        ja: [
            // 일본어는 로마자 입력 방식 (히라가나 변환은 서버 측에서 처리 예정)
            ['q','w','e','r','t','y','u','i','o','p'],
            ['a','s','d','f','g','h','j','k','l'],
            [{label:'⇧', cls:'key-shift', action:'shift'},'z','x','c','v','b','n','m',{label:'⌫', cls:'key-del', action:'backspace'}],
            [{label:'123', cls:'key-num', action:'num'},{label:'Space', value:' ', cls:'key-space'},{label:'↵', cls:'key-enter', action:'enter'}]
        ]
    };

    // ========== CSS 스타일 ==========
    const WIDGET_CSS = `
        /* ---- Shadow DOM 기본 초기화 ---- */
        :host {
            all: initial;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #1a1a2e;
            box-sizing: border-box;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ---- 채팅 열기 버튼 (오른쪽 하단 고정) ---- */
        .toggle-btn {
            position: fixed; bottom: 24px; right: 24px;
            width: 60px; height: 60px; border-radius: 50%; border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            box-shadow: 0 4px 20px rgba(102,126,234,0.45);
            cursor: pointer; z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .toggle-btn:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(102,126,234,0.6); }
        .toggle-btn svg { width: 28px; height: 28px; fill: white; }
        .toggle-btn .badge {
            position: absolute; top: -4px; right: -4px;
            min-width: 20px; height: 20px; border-radius: 10px;
            background: #ff4757; color: white; font-size: 11px; font-weight: bold;
            display: none; align-items: center; justify-content: center;
            border: 2px solid white; padding: 0 4px;
        }
        .toggle-btn .badge.show { display: flex; }

        /* ---- 채팅 창 ---- */
        .chat-window {
            position: fixed; bottom: 96px; right: 24px;
            width: 380px; height: 580px; max-height: calc(100vh - 120px);
            border-radius: 16px; overflow: hidden; z-index: 99998;
            background: #fff;
            box-shadow: 0 12px 48px rgba(0,0,0,0.18);
            display: flex; flex-direction: column;
            opacity: 0; transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .chat-window.open {
            opacity: 1; transform: translateY(0) scale(1); pointer-events: auto;
        }

        /* 모바일: 전체 화면으로 */
        @media (max-width: 480px) {
            .chat-window { bottom: 0; right: 0; width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
            .toggle-btn  { bottom: 16px; right: 16px; }
        }

        /* ---- 헤더 ---- */
        .header {
            padding: 14px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; flex-shrink: 0;
            display: flex; align-items: center; gap: 10px;
        }
        .header-info { flex: 1; }
        .header-title { font-size: 15px; font-weight: 700; }
        .header-sub   { font-size: 11px; opacity: 0.85; margin-top: 1px; }
        .header-actions { display: flex; gap: 6px; }
        .header-actions button {
            background: rgba(255,255,255,0.2); border: none; color: white;
            width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
            display: flex; align-items: center; justify-content: center; font-size: 14px;
            transition: background 0.2s;
        }
        .header-actions button:hover { background: rgba(255,255,255,0.35); }
        .end-chat-btn { font-size: 16px !important; }

        /* 언어 선택 탭 */
        .lang-tabs {
            display: flex; gap: 4px; padding: 8px 12px;
            background: #f8f9ff; border-bottom: 1px solid #e8ecff; flex-shrink: 0;
        }
        .lang-tab {
            flex: 1; padding: 5px 2px; border: 1px solid #d0d7ff;
            border-radius: 6px; background: white; cursor: pointer;
            font-size: 11px; color: #667eea; text-align: center;
            transition: all 0.2s;
        }
        .lang-tab.active {
            background: #667eea; color: white; border-color: #667eea;
            font-weight: 600;
        }

        /* ---- 메시지 목록 영역 ---- */
        .messages {
            flex: 1; overflow-y: auto; padding: 12px;
            display: flex; flex-direction: column; gap: 8px;
            background: #f8f9ff;
        }
        .messages::-webkit-scrollbar { width: 4px; }
        .messages::-webkit-scrollbar-thumb { background: #c5cbe8; border-radius: 2px; }

        /* 메시지 말풍선 기본 */
        .msg { display: flex; flex-direction: column; max-width: 80%; gap: 3px; }
        .msg.guest   { align-self: flex-end; align-items: flex-end; }
        .msg.system,
        .msg.manager { align-self: flex-start; align-items: flex-start; }

        .msg-label { font-size: 10px; color: #888; padding: 0 4px; }

        .msg-bubble {
            padding: 9px 13px; border-radius: 16px;
            line-height: 1.5; word-break: break-word;
        }
        .msg.guest .msg-bubble {
            background: #667eea; color: white;
            border-bottom-right-radius: 4px;
        }
        .msg.system .msg-bubble {
            background: white; color: #444;
            border: 1px solid #e0e4f5;
            border-bottom-left-radius: 4px;
        }
        .msg.manager .msg-bubble {
            background: #eefaf3; color: #2d6a4f;
            border: 1px solid #b7e4c7;
            border-bottom-left-radius: 4px;
        }

        .msg-time { font-size: 9px; color: #aaa; padding: 0 4px; }

        /* 매니저 연결 버튼 바 (입력창 위 고정 영역) */
        .manager-bar {
            display: none; justify-content: center;
            padding: 8px 16px; background: #fff5f5;
            border-top: 1px solid #ffd6d6; flex-shrink: 0;
        }
        .manager-bar.show { display: flex; }
        .manager-btn {
            padding: 9px 20px; border-radius: 20px; border: none;
            background: #ff6b6b; color: white; cursor: pointer;
            font-size: 13px; font-weight: 600; width: 100%;
            transition: background 0.2s, transform 0.1s;
        }
        .manager-btn:hover  { background: #ee5a24; transform: scale(1.02); }
        .manager-btn:active { transform: scale(0.98); }
        .manager-btn.requested { background: #aaa; cursor: default; }

        /* ---- 입력 영역 ---- */
        .input-area {
            border-top: 1px solid #e8ecff;
            background: white; flex-shrink: 0;
        }
        .input-row {
            display: flex; align-items: flex-end; gap: 8px;
            padding: 10px 12px;
        }
        .input-row textarea {
            flex: 1; border: 1px solid #d0d7ff; border-radius: 12px;
            padding: 9px 13px; resize: none; font-size: 13px;
            font-family: inherit; color: #333; outline: none;
            min-height: 42px; max-height: 100px;
            transition: border-color 0.2s;
            line-height: 1.4;
        }
        .input-row textarea:focus { border-color: #667eea; }
        .send-btn {
            width: 40px; height: 40px; border-radius: 50%; border: none;
            background: #667eea; color: white; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; transition: background 0.2s, transform 0.1s;
        }
        .send-btn:hover  { background: #5a6fd6; }
        .send-btn:active { transform: scale(0.93); }
        .send-btn svg { width: 18px; height: 18px; fill: white; }
        .kb-toggle-btn {
            width: 40px; height: 40px; border-radius: 50%; border: 1px solid #d0d7ff;
            background: white; cursor: pointer; font-size: 16px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; transition: background 0.2s;
        }
        .kb-toggle-btn:hover { background: #f0f2ff; }
        .kb-toggle-btn.active { background: #667eea; border-color: #667eea; }

        /* ---- 가상 키보드 ---- */
        .keyboard {
            background: #dde1f0; padding: 6px 6px 10px;
            display: none; flex-direction: column; gap: 4px;
        }
        .keyboard.show { display: flex; }
        .kb-row { display: flex; justify-content: center; gap: 4px; }
        .key {
            min-width: 30px; height: 40px; border-radius: 6px;
            border: none; background: white; cursor: pointer;
            font-size: 13px; color: #333; font-family: inherit;
            box-shadow: 0 1px 2px rgba(0,0,0,0.15);
            transition: background 0.1s, transform 0.05s;
            display: flex; align-items: center; justify-content: center;
            padding: 0 6px;
        }
        .key:hover  { background: #f0f4ff; }
        .key:active { background: #c8d0f5; transform: scale(0.94); }
        .key-shift  { min-width: 40px; background: #b0b8d0; color: #333; }
        .key-del    { min-width: 40px; background: #b0b8d0; color: #333; }
        .key-space  { min-width: 130px; }
        .key-enter  { min-width: 50px; background: #667eea; color: white; }
        .key-num    { min-width: 40px; background: #b0b8d0; }
        .key-active { background: #667eea !important; color: white !important; }
    `;

    // ========== 위젯 클래스 ==========
    class YakoreaWidget {
        constructor() {
            // --- 상태 변수 ---
            this.isOpen        = false;       // 채팅창 열림 여부
            this.language      = 'ko';        // 현재 선택된 언어
            this.sessionId     = this._getOrCreateSessionId();  // 세션 ID
            this.roomId        = null;        // 대화방 UUID
            this.socket        = null;        // Socket.IO 소켓
            this.isKbOpen      = false;       // 가상 키보드 열림 여부
            this.kbMode        = 'ko';        // 키보드 현재 레이아웃 (ko, en, en_upper, num)
            this.isManagerRequested = false;  // 매니저 연결 요청 여부
            this.unreadCount   = 0;           // 미읽음 메시지 수

            // Shadow DOM으로 기존 페이지 CSS와 격리
            this.host        = document.createElement('div');
            this.shadowRoot  = this.host.attachShadow({ mode: 'open' });
            document.body.appendChild(this.host);

            // UI 초기화 및 소켓 연결
            this._buildUI();
            this._loadSocketIO(() => this._connectSocket());
        }

        // ================================================
        // 세션 ID 관리
        // ================================================

        /** 브라우저에 저장된 세션 ID를 가져오거나, 없으면 새로 생성합니다. */
        _getOrCreateSessionId() {
            const key = 'yakorea_chat_session';
            let id = localStorage.getItem(key);
            if (!id) {
                id = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
                localStorage.setItem(key, id);
            }
            return id;
        }

        // ================================================
        // UI 빌드
        // ================================================

        /** Shadow DOM 내에 전체 위젯 HTML을 렌더링합니다. */
        _buildUI() {
            const i = I18N[this.language];
            this.shadowRoot.innerHTML = `
                <style>${WIDGET_CSS}</style>

                <!-- 오른쪽 하단 열기 버튼 -->
                <button class="toggle-btn" id="toggleBtn" title="${i.title}">
                    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                    <span class="badge" id="badge"></span>
                </button>

                <!-- 채팅 창 -->
                <div class="chat-window" id="chatWindow">

                    <!-- 헤더 -->
                    <div class="header">
                        <div class="header-info">
                            <div class="header-title">${i.title}</div>
                            <div class="header-sub" id="headerSub">연결 중...</div>
                        </div>
                        <div class="header-actions">
                            <button id="endChatBtn" class="end-chat-btn" title="${i.close_chat}">🚪</button>
                            <button id="closeBtn" title="닫기">✕</button>
                        </div>
                    </div>

                    <!-- 언어 선택 탭 -->
                    <div class="lang-tabs">
                        <button class="lang-tab ${this.language === 'ko' ? 'active' : ''}" data-lang="ko">${i.lang_ko}</button>
                        <button class="lang-tab ${this.language === 'en' ? 'active' : ''}" data-lang="en">${i.lang_en}</button>
                        <button class="lang-tab ${this.language === 'zh' ? 'active' : ''}" data-lang="zh">${i.lang_zh}</button>
                        <button class="lang-tab ${this.language === 'ja' ? 'active' : ''}" data-lang="ja">${i.lang_ja}</button>
                    </div>

                    <!-- 메시지 목록 -->
                    <div class="messages" id="messages"></div>

                    <!-- 매니저 연결 버튼 바 (폴백 발생 시 표시) -->
                    <div class="manager-bar" id="managerBar">
                        <button class="manager-btn" id="managerBtn">${i.manager_btn}</button>
                    </div>

                    <!-- 입력 영역 -->
                    <div class="input-area">
                        <div class="input-row">
                            <button class="kb-toggle-btn" id="kbToggleBtn" title="${i.keyboard_btn}">⌨️</button>
                            <textarea id="msgInput" placeholder="${i.placeholder}" rows="1"></textarea>
                            <button class="send-btn" id="sendBtn">
                                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                            </button>
                        </div>
                        <!-- 가상 키보드 (기본 숨김) -->
                        <div class="keyboard" id="keyboard"></div>
                    </div>
                </div>
            `;

            // UI 요소 참조 저장
            this.el = {
                toggleBtn:   this.shadowRoot.getElementById('toggleBtn'),
                badge:       this.shadowRoot.getElementById('badge'),
                chatWindow:  this.shadowRoot.getElementById('chatWindow'),
                headerSub:   this.shadowRoot.getElementById('headerSub'),
                closeBtn:    this.shadowRoot.getElementById('closeBtn'),
                messages:    this.shadowRoot.getElementById('messages'),
                msgInput:    this.shadowRoot.getElementById('msgInput'),
                sendBtn:     this.shadowRoot.getElementById('sendBtn'),
                kbToggleBtn: this.shadowRoot.getElementById('kbToggleBtn'),
                keyboard:    this.shadowRoot.getElementById('keyboard'),
                langTabs:    this.shadowRoot.querySelectorAll('.lang-tab'),
                managerBar:  this.shadowRoot.getElementById('managerBar'),
                managerBtn:  this.shadowRoot.getElementById('managerBtn'),
                endChatBtn:  this.shadowRoot.getElementById('endChatBtn')
            };

            this._bindEvents();
            this._renderKeyboard();
        }

        // ================================================
        // 이벤트 바인딩
        // ================================================

        _bindEvents() {
            // 채팅창 열기/닫기
            this.el.toggleBtn.addEventListener('click', () => this._toggleChat());
            this.el.closeBtn.addEventListener('click',  () => this._toggleChat(false));

            // 대화 종료 (손님이 직접 종료)
            this.el.endChatBtn.addEventListener('click', () => this._endChat());

            // 메시지 전송
            this.el.sendBtn.addEventListener('click', () => this._sendMessage());
            this.el.msgInput.addEventListener('keydown', (e) => {
                // Enter 단독 → 전송, Shift+Enter → 줄바꿈
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._sendMessage();
                }
            });
            // 텍스트 영역 자동 높이 조절
            this.el.msgInput.addEventListener('input', () => {
                this.el.msgInput.style.height = 'auto';
                this.el.msgInput.style.height = Math.min(this.el.msgInput.scrollHeight, 100) + 'px';
            });

            // 매니저 연결 버튼
            this.el.managerBtn.addEventListener('click', () => {
                if (this.isManagerRequested) return;
                this.isManagerRequested = true;
                const i = I18N[this.language];
                this.el.managerBtn.textContent = i.manager_requested;
                this.el.managerBtn.classList.add('requested');
                if (this.socket && this.roomId) {
                    this.socket.emit('guest:request_manager', { roomId: this.roomId });
                }
            });

            // 가상 키보드 토글
            this.el.kbToggleBtn.addEventListener('click', () => this._toggleKeyboard());

            // 언어 탭 전환
            this.el.langTabs.forEach(tab => {
                tab.addEventListener('click', () => this._changeLanguage(tab.dataset.lang));
            });
        }

        // ================================================
        // 채팅창 열기/닫기
        // ================================================

        _toggleChat(forceState) {
            this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
            this.el.chatWindow.classList.toggle('open', this.isOpen);

            if (this.isOpen) {
                // 채팅창이 열리면: 미읽음 카운트 초기화, 대화방 생성
                this.unreadCount = 0;
                this._updateBadge();
                if (!this.roomId) this._createRoom();
                setTimeout(() => this.el.msgInput.focus(), 300);
            }
        }

        // ================================================
        // 언어 전환
        // ================================================

        _changeLanguage(lang) {
            if (this.language === lang) return;
            this.language = lang;
            this.kbMode   = lang;  // 키보드 레이아웃도 언어에 맞춰 전환

            // 언어 탭 활성화 상태 갱신
            this.el.langTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.lang === lang);
            });

            // 입력창 placeholder 갱신
            this.el.msgInput.placeholder = I18N[lang].placeholder;

            // 키보드 레이아웃 갱신
            this._renderKeyboard();
        }

        // ================================================
        // 가상 키보드
        // ================================================

        _toggleKeyboard() {
            this.isKbOpen = !this.isKbOpen;
            this.el.keyboard.classList.toggle('show', this.isKbOpen);
            this.el.kbToggleBtn.classList.toggle('active', this.isKbOpen);
        }

        /**
         * 현재 kbMode에 맞는 키보드 레이아웃을 렌더링합니다.
         * 레이아웃은 KB_LAYOUTS에서 가져옵니다.
         */
        _renderKeyboard() {
            const layout = KB_LAYOUTS[this.kbMode] || KB_LAYOUTS.en;
            this.el.keyboard.innerHTML = '';

            layout.forEach(row => {
                const rowEl = document.createElement('div');
                rowEl.className = 'kb-row';

                row.forEach(key => {
                    const btn    = document.createElement('button');
                    btn.className = 'key';

                    if (typeof key === 'string') {
                        // 일반 문자 키
                        btn.textContent = key;
                        btn.addEventListener('click', () => this._onKeyPress(key));
                    } else {
                        // 특수 키 (액션 포함)
                        btn.textContent = key.label;
                        if (key.cls) key.cls.split(' ').forEach(c => btn.classList.add(c));

                        btn.addEventListener('click', () => {
                            if (key.action === 'backspace') {
                                this._onKeyBackspace();
                            } else if (key.action === 'enter') {
                                this._sendMessage();
                            } else if (key.action === 'shift') {
                                // Shift: 대소문자 전환
                                this.kbMode = this.kbMode === 'en' ? 'en_upper' : 'en';
                                this._renderKeyboard();
                            } else if (key.action === 'num') {
                                // 숫자/특수문자 레이아웃으로 전환
                                this.kbMode = 'num';
                                this._renderKeyboard();
                            } else if (key.action === 'alpha') {
                                // 영문 레이아웃으로 복귀
                                this.kbMode = this.language === 'ko' ? 'ko' : 'en';
                                this._renderKeyboard();
                            } else if (key.value) {
                                this._onKeyPress(key.value);
                            }
                        });
                    }

                    rowEl.appendChild(btn);
                });

                this.el.keyboard.appendChild(rowEl);
            });
        }

        /** 가상 키보드 문자 입력 처리 */
        _onKeyPress(char) {
            const input = this.el.msgInput;
            const start = input.selectionStart;
            const end   = input.selectionEnd;
            const val   = input.value;

            // 커서 위치에 문자 삽입
            input.value = val.slice(0, start) + char + val.slice(end);
            input.selectionStart = input.selectionEnd = start + char.length;

            // 자동 높이 조절 트리거
            input.dispatchEvent(new Event('input'));
            input.focus();
        }

        /** 가상 키보드 백스페이스 처리 */
        _onKeyBackspace() {
            const input = this.el.msgInput;
            const start = input.selectionStart;
            const end   = input.selectionEnd;
            const val   = input.value;

            if (start === end && start > 0) {
                // 선택 없음: 커서 앞 1글자 삭제
                input.value = val.slice(0, start - 1) + val.slice(end);
                input.selectionStart = input.selectionEnd = start - 1;
            } else {
                // 선택 영역 삭제
                input.value = val.slice(0, start) + val.slice(end);
                input.selectionStart = input.selectionEnd = start;
            }

            input.dispatchEvent(new Event('input'));
            input.focus();
        }

        // ================================================
        // Socket.IO 동적 로드 및 연결
        // ================================================

        /** Socket.IO 클라이언트 라이브러리를 CDN에서 동적으로 로드합니다. */
        _loadSocketIO(callback) {
            if (window.io) { callback(); return; }

            const script = document.createElement('script');
            script.src = `${SERVER_URL}/socket.io/socket.io.js`;
            script.onload  = callback;
            script.onerror = () => {
                console.error('[Widget] Socket.IO 로드 실패. 서버 주소를 확인하세요:', SERVER_URL);
                this.el.headerSub.textContent = '서버 연결 실패';
            };
            document.head.appendChild(script);
        }

        /** Socket.IO 서버에 연결하고 이벤트 핸들러를 등록합니다. */
        _connectSocket() {
            this.socket = window.io(SERVER_URL, {
                transports:         ['websocket', 'polling'],
                reconnectionAttempts: 10,
                reconnectionDelay:    2000
            });

            // 연결 성공
            this.socket.on('connect', () => {
                console.log('[Widget] 소켓 연결 성공:', this.socket.id);
                this.el.headerSub.textContent = '연결됨';
                // 이미 대화방이 있으면 재조인
                if (this.roomId) {
                    this.socket.emit('guest:join', { roomId: this.roomId, sessionId: this.sessionId });
                }
            });

            // 연결 해제
            this.socket.on('disconnect', () => {
                this.el.headerSub.textContent = '연결 끊김 — 재연결 중...';
            });

            // 새 메시지 수신
            this.socket.on('new_message', ({ message }) => {
                console.log('[Widget] new_message 수신:', JSON.stringify({ sender_type: message.sender_type, is_auto_reply: message.is_auto_reply, content: message.content?.substring(0, 30) }));
                this._appendMessage(message);
                // 폴백(자동응답 실패) 시스템 메시지면 매니저 버튼 bar 표시
                if (message.sender_type === 'system' && message.is_auto_reply) {
                    console.log('[Widget] ✅ 매니저 버튼 표시 조건 충족!');
                    this._appendManagerButton();
                }
                // 매니저가 직접 연결되면 매니저 버튼 숨김
                if (message.sender_type === 'manager' && !message.is_auto_reply) {
                    this.el.managerBtn.style.display = 'none';
                }
                // 채팅창이 닫혀있으면 배지 카운트 증가
                if (!this.isOpen && message.sender_type !== 'guest') {
                    this.unreadCount++;
                    this._updateBadge();
                }
            });

            // 대화방 종료 알림 (매니저가 종료했을 때)
            this.socket.on('room_closed', () => {
                console.log('[Widget] 대화방 종료됨 — 새 대화방 준비');
                this.roomId = null;
                this.isManagerRequested = false;
                // 매니저 버튼 상태 초기화
                const i = I18N[this.language];
                this.el.managerBtn.textContent = i.manager_btn;
                this.el.managerBtn.classList.remove('requested');
                this.el.managerBtn.style.display = '';
            });

            // 서버 에러
            this.socket.on('error', ({ message }) => {
                console.error('[Widget] 서버 에러:', message);
            });
        }

        // ================================================
        // 대화방 생성
        // ================================================

        /** 서버 API를 호출하여 대화방을 생성하고 소켓 룸에 조인합니다. */
        async _createRoom() {
            try {
                const res = await fetch(`${SERVER_URL}/api/chat/rooms`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ sessionId: this.sessionId, language: this.language })
                });
                const data = await res.json();

                if (!data.room) throw new Error('대화방 생성 실패');

                this.roomId = data.room.id;

                // 소켓 룸에 조인
                if (this.socket) {
                    this.socket.emit('guest:join', { roomId: this.roomId, sessionId: this.sessionId });
                }

                // 기존 대화방이면 이전 메시지 불러오기
                if (!data.isNew) {
                    await this._loadMessages();
                } else {
                    // 신규 대화방이면 환영 메시지 불러오기
                    await this._loadMessages();
                }

            } catch (err) {
                console.error('[Widget] 대화방 생성 에러:', err.message);
            }
        }

        // ================================================
        // 메시지 로드 (초기 진입 시)
        // ================================================

        async _loadMessages() {
            if (!this.roomId) return;
            try {
                const res  = await fetch(`${SERVER_URL}/api/chat/rooms/${this.roomId}/messages`);
                const data = await res.json();
                const messages = data.messages || [];
                messages.forEach(msg => this._appendMessage(msg, false));

                // 히스토리에 폴백(자동응답 실패) 메시지가 있으면 매니저 버튼 표시
                const hasFallback = messages.some(msg =>
                    msg.sender_type === 'system' && msg.is_auto_reply
                );
                // 매니저가 이미 연결된 경우는 버튼 숨김 유지
                const hasManager = messages.some(msg =>
                    msg.sender_type === 'manager' && !msg.is_auto_reply
                );
                if (hasFallback && !hasManager) {
                    this._appendManagerButton();
                }

                this._scrollToBottom();
            } catch (err) {
                console.error('[Widget] 메시지 로드 에러:', err.message);
            }
        }

        // ================================================
        // 메시지 표시
        // ================================================

        /**
         * 메시지 말풍선을 메시지 목록에 추가합니다.
         *
         * @param {Object}  msg         - 메시지 레코드 (DB에서 온 형태)
         * @param {boolean} doScroll    - true면 자동 스크롤 (기본 true)
         */
        _appendMessage(msg, doScroll = true) {
            const i    = I18N[this.language];
            const type = msg.sender_type;  // guest | manager | system

            const el = document.createElement('div');
            el.className = `msg ${type}`;

            // 레이블 (매니저/시스템 메시지에만 표시)
            if (type !== 'guest') {
                const labelEl = document.createElement('div');
                labelEl.className = 'msg-label';
                labelEl.textContent = type === 'manager'
                    ? (msg.is_auto_reply ? i.auto_reply_label : i.manager_label)
                    : i.system_label;
                el.appendChild(labelEl);
            }

            // 말풍선 본문
            const bubbleEl = document.createElement('div');
            bubbleEl.className = 'msg-bubble';
            bubbleEl.textContent = msg.content;
            el.appendChild(bubbleEl);

            // 시간 표시
            const timeEl = document.createElement('div');
            timeEl.className = 'msg-time';
            timeEl.textContent = this._formatTime(msg.created_at);
            el.appendChild(timeEl);

            this.el.messages.appendChild(el);

            if (doScroll) this._scrollToBottom();
        }

        /** 매니저와 대화하기 버튼을 메시지 목록에 추가합니다. */
        _appendManagerButton() {
            // 이미 요청됐으면 bar는 계속 보여주되 버튼 상태만 유지
            this.el.managerBar.classList.add('show');
        }

        /** 손님이 직접 대화를 종료합니다. */
        _endChat() {
            const i = I18N[this.language];
            if (!confirm(i.confirm_close)) return;

            // 서버에 대화방 종료 요청 (roomId가 있을 때만)
            if (this.roomId && this.socket) {
                this.socket.emit('guest:close_room', { roomId: this.roomId });
            }

            // 로컬 상태 초기화
            this.roomId = null;
            this.isManagerRequested = false;
            this.el.managerBtn.textContent = i.manager_btn;
            this.el.managerBtn.classList.remove('requested');
            this.el.managerBtn.style.display = '';
            this.el.messages.innerHTML = '';
        }

        // ================================================
        // 메시지 전송
        // ================================================

        async _sendMessage() {
            const content = this.el.msgInput.value.trim();
            if (!content || !this.socket) return;

            // 대화방이 종료된 상태면 새 대화방 생성 후 전송
            if (!this.roomId) {
                await this._createRoom();
                if (!this.roomId) return;  // 대화방 생성 실패 시 중단
            }

            // 소켓으로 메시지 전송 (낙관적 UI: 서버 응답 전에 화면에 즉시 표시)
            this.socket.emit('guest:send_message', { roomId: this.roomId, content });

            // 입력창 초기화
            this.el.msgInput.value  = '';
            this.el.msgInput.style.height = 'auto';
        }

        // ================================================
        // 유틸리티
        // ================================================

        _updateBadge() {
            if (this.unreadCount > 0) {
                this.el.badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
                this.el.badge.classList.add('show');
            } else {
                this.el.badge.classList.remove('show');
            }
        }

        _scrollToBottom() {
            requestAnimationFrame(() => {
                this.el.messages.scrollTop = this.el.messages.scrollHeight;
            });
        }

        _formatTime(iso) {
            if (!iso) return '';
            const d = new Date(iso);
            return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        }
    }

    // ========== 위젯 인스턴스 생성 ==========
    // DOM이 준비된 후 위젯을 초기화합니다.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new YakoreaWidget());
    } else {
        new YakoreaWidget();
    }

})();
