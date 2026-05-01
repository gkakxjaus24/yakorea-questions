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
  const NAME_KEY = 'ya_qr_name';
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
  const VIRTUAL_KB_LANGS = ['ko', 'en', 'zh', 'ja', 'ru', 'es'];

  // ── i18n ──────────────────────────────────────────────────────
  const WIDGET_TEXT = {
    ko: {
      brandTitle: 'Yakorea Hostel',
      toggleAriaLabel: '채팅 열기',
      candidatesLabel: '혹시 이런 내용을 찾으시나요?',
      escalateOffer: '답변을 찾지 못했습니다. 매니저와 연결하시겠어요?',
      statusAuto: '자동응답 중', statusWaiting: '매니저 연결 대기 중',
      statusActive: '매니저 상담 중', statusClosed: '대화가 종료되었습니다',
      placeholder: '메시지를 입력하세요...', welcome: '안녕하세요! 무엇을 도와드릴까요? 😊',
      escalateBtn: '👤 매니저와 연결하기', closeConfirm: '대화를 종료하시겠어요?',
      closedMsg: '대화를 종료했습니다.', closedByManager: '매니저가 대화를 종료했습니다.',
      closedByIdle: '장시간 활동이 없어 대화가 자동 종료되었습니다.',
      escalateRequest: '매니저 연결 요청을 보냈습니다. 잠시만 기다려 주세요.',
      kbSend: '전송', closeBtnLabel: '대화종료',
      closeConfirmYes: '확인', closeConfirmNo: '취소',
      // QR 게이트
      checkoutTitle: '체크아웃 날짜를 입력해주세요',
      checkoutNext: '다음 →',
      checkoutBlockedMsg: '체크아웃 이후에는 채팅을 이용하실 수 없습니다.',
      roomGateTitle: '방 번호를 선택해주세요',
      bedBack: '← 방 번호 다시 선택',
      nameTitle: '이름을 입력해주세요',
      nameSubmitBtn: '채팅 시작하기',
      nameErrorMsg: '이름을 입력해주세요',
      namePlaceholder: '홍길동',
      bedUnit: '번',
      // 키오스크 게이트
      kioskStageTitle: '어떻게 도와드릴까요?',
      kioskStagePreCheckin: '체크인 전 (아직 방이 배정되지 않았어요)',
      kioskStagePostCheckin: '방번호 입력',
      nameKbHint: '이름은 영어로만 입력해 주세요',
    },
    en: {
      brandTitle: 'Yakorea Hostel',
      toggleAriaLabel: 'Open chat',
      candidatesLabel: 'Were you looking for one of these?',
      escalateOffer: "We couldn't find an answer. Connect to a manager?",
      statusAuto: 'Auto-reply', statusWaiting: 'Waiting for manager',
      statusActive: 'Chatting with manager', statusClosed: 'Chat ended',
      placeholder: 'Type a message...', welcome: 'Hello! How can we help you? 😊',
      escalateBtn: '👤 Connect to manager', closeConfirm: 'End this conversation?',
      closedMsg: 'Conversation ended.', closedByManager: 'Manager has ended the chat.',
      closedByIdle: 'Chat ended due to inactivity.',
      escalateRequest: 'Connecting to manager. Please wait.',
      kbSend: 'Send', closeBtnLabel: 'End Chat',
      closeConfirmYes: 'OK', closeConfirmNo: 'Cancel',
      // QR gates
      checkoutTitle: 'Enter your check-out date',
      checkoutNext: 'Next →',
      checkoutBlockedMsg: 'Chat is not available after your check-out date.',
      roomGateTitle: 'Select your room number',
      bedBack: '← Back to room selection',
      nameTitle: 'Enter your name',
      nameSubmitBtn: 'Start Chat',
      nameErrorMsg: 'Please enter your name',
      namePlaceholder: 'Your name',
      bedUnit: '',
      // Kiosk gate
      kioskStageTitle: 'How can we help you?',
      kioskStagePreCheckin: 'Before check-in (no room assigned yet)',
      kioskStagePostCheckin: 'Enter room number',
      nameKbHint: 'Please enter your name in English only',
    },
    zh: {
      brandTitle: 'Yakorea Hostel',
      toggleAriaLabel: '打开聊天',
      candidatesLabel: '您是否在找这些内容？',
      escalateOffer: '未能找到答案。要联系客服吗？',
      statusAuto: '自动回复中', statusWaiting: '等待客服',
      statusActive: '客服服务中', statusClosed: '对话已结束',
      placeholder: '请输入消息...', welcome: '您好！有什么可以帮助您？😊',
      escalateBtn: '👤 联系客服', closeConfirm: '确定结束对话？',
      closedMsg: '对话已结束。', closedByManager: '客服已结束对话。',
      closedByIdle: '长时间无活动，对话已自动结束。',
      escalateRequest: '正在联系客服，请稍候。',
      kbSend: '发送', closeBtnLabel: '结束对话',
      closeConfirmYes: '确定', closeConfirmNo: '取消',
      // QR 게이트
      checkoutTitle: '请输入退房日期',
      checkoutNext: '下一步 →',
      checkoutBlockedMsg: '退房后无法使用聊天服务。',
      roomGateTitle: '请选择您的房间号',
      bedBack: '← 返回房间选择',
      nameTitle: '请输入您的姓名',
      nameSubmitBtn: '开始聊天',
      nameErrorMsg: '请输入您的姓名',
      namePlaceholder: '您的姓名',
      bedUnit: '号',
      // 自助终端入口
      kioskStageTitle: '请问需要什么帮助？',
      kioskStagePreCheckin: '入住前（尚未分配房间）',
      kioskStagePostCheckin: '输入房间号',
      nameKbHint: '请用英文输入姓名',
    },
    ja: {
      brandTitle: 'Yakorea Hostel',
      toggleAriaLabel: 'チャットを開く',
      candidatesLabel: 'こちらの内容をお探しですか？',
      escalateOffer: '回答が見つかりませんでした。スタッフにおつなぎしますか？',
      statusAuto: '自動応答中', statusWaiting: 'スタッフ接続待ち',
      statusActive: 'スタッフ対応中', statusClosed: 'チャット終了',
      placeholder: 'メッセージを入力...', welcome: 'こんにちは！何かお手伝いできますか？😊',
      escalateBtn: '👤 スタッフに連絡', closeConfirm: 'チャットを終了しますか？',
      closedMsg: 'チャットを終了しました。', closedByManager: 'スタッフがチャットを終了しました。',
      closedByIdle: '長時間操作がなかったため、チャットが終了しました。',
      escalateRequest: 'スタッフに接続中です。しばらくお待ちください。',
      kbSend: '送信', closeBtnLabel: 'チャット終了',
      closeConfirmYes: 'OK', closeConfirmNo: 'キャンセル',
      // QR ゲート
      checkoutTitle: 'チェックアウト日を入力してください',
      checkoutNext: '次へ →',
      checkoutBlockedMsg: 'チェックアウト後はチャットをご利用いただけません。',
      roomGateTitle: '部屋番号を選択してください',
      bedBack: '← 部屋番号の選択に戻る',
      nameTitle: 'お名前を入力してください',
      nameSubmitBtn: 'チャットを開始',
      nameErrorMsg: 'お名前を入力してください',
      namePlaceholder: 'お名前',
      bedUnit: '番',
      // キオスクゲート
      kioskStageTitle: 'ご用件をお選びください',
      kioskStagePreCheckin: 'チェックイン前（部屋未割り当て）',
      kioskStagePostCheckin: '部屋番号を入力',
      nameKbHint: 'お名前は英語のみで入力してください',
    },
    ru: {
      brandTitle: 'Yakorea Hostel',
      toggleAriaLabel: 'Открыть чат',
      candidatesLabel: 'Возможно, вы искали это?',
      escalateOffer: 'Ответ не найден. Связаться с менеджером?',
      statusAuto: 'Автоответ', statusWaiting: 'Ожидание менеджера',
      statusActive: 'Чат с менеджером', statusClosed: 'Чат завершён',
      placeholder: 'Введите сообщение...', welcome: 'Здравствуйте! Чем можем помочь? 😊',
      escalateBtn: '👤 Связаться с менеджером', closeConfirm: 'Завершить чат?',
      closedMsg: 'Чат завершён.', closedByManager: 'Менеджер завершил чат.',
      closedByIdle: 'Чат завершён из-за неактивности.',
      escalateRequest: 'Подключение к менеджеру. Пожалуйста, подождите.',
      kbSend: 'Отправить', closeBtnLabel: 'Завершить',
      closeConfirmYes: 'Да', closeConfirmNo: 'Нет',
      // QR ворота
      checkoutTitle: 'Введите дату выезда',
      checkoutNext: 'Далее →',
      checkoutBlockedMsg: 'Чат недоступен после даты выезда.',
      roomGateTitle: 'Выберите номер комнаты',
      bedBack: '← Вернуться к выбору комнаты',
      nameTitle: 'Введите ваше имя',
      nameSubmitBtn: 'Начать чат',
      nameErrorMsg: 'Пожалуйста, введите ваше имя',
      namePlaceholder: 'Ваше имя',
      bedUnit: '',
      // Киоск
      kioskStageTitle: 'Чем мы можем помочь?',
      kioskStagePreCheckin: 'До заселения (комната ещё не назначена)',
      kioskStagePostCheckin: 'Ввести номер комнаты',
      nameKbHint: 'Введите имя только на английском',
    },
    es: {
      brandTitle: 'Yakorea Hostel',
      toggleAriaLabel: 'Abrir chat',
      candidatesLabel: '¿Estaba buscando alguno de estos?',
      escalateOffer: 'No encontramos una respuesta. ¿Conectar con el gerente?',
      statusAuto: 'Respuesta automática', statusWaiting: 'Esperando al gerente',
      statusActive: 'Chat con el gerente', statusClosed: 'Chat finalizado',
      placeholder: 'Escribe un mensaje...', welcome: '¡Hola! ¿En qué podemos ayudarte? 😊',
      escalateBtn: '👤 Conectar con gerente', closeConfirm: '¿Finalizar la conversación?',
      closedMsg: 'Conversación finalizada.', closedByManager: 'El gerente ha finalizado el chat.',
      closedByIdle: 'Chat finalizado por inactividad.',
      escalateRequest: 'Conectando con el gerente. Por favor espera.',
      kbSend: 'Enviar', closeBtnLabel: 'Finalizar',
      closeConfirmYes: 'Sí', closeConfirmNo: 'Cancelar',
      // Puertas QR
      checkoutTitle: 'Ingresa tu fecha de salida',
      checkoutNext: 'Siguiente →',
      checkoutBlockedMsg: 'El chat no está disponible después de tu fecha de salida.',
      roomGateTitle: 'Selecciona tu número de habitación',
      bedBack: '← Volver a selección de habitación',
      nameTitle: 'Ingresa tu nombre',
      nameSubmitBtn: 'Iniciar chat',
      nameErrorMsg: 'Por favor ingresa tu nombre',
      namePlaceholder: 'Tu nombre',
      bedUnit: '',
      // Kiosco
      kioskStageTitle: '¿En qué podemos ayudarte?',
      kioskStagePreCheckin: 'Antes del check-in (sin habitación asignada)',
      kioskStagePostCheckin: 'Ingresar número de habitación',
      nameKbHint: 'Por favor escribe tu nombre solo en inglés',
    },
  };

  // 객실 라벨 포맷터 (언어별 "방 207" 표기)
  function formatRoomLabel(label, lang) {
    if (!label) return '';
    // 도미토리 침대 번호 (예: "B1-3") 처리
    const [room, bed] = String(label).split('-');
    const roomFmt = (() => {
      switch (lang) {
        case 'en': return `Room ${room}`;
        case 'zh': return `${room}号房`;
        case 'ja': return `${room}号室`;
        case 'ru': return `Комната ${room}`;
        case 'es': return `Hab. ${room}`;
        case 'ko':
        default:   return `${room}호`;
      }
    })();
    if (!bed) return roomFmt;
    // 침대 번호 부가
    switch (lang) {
      case 'en': return `${roomFmt} · Bed ${bed}`;
      case 'zh': return `${roomFmt} · ${bed}号床`;
      case 'ja': return `${roomFmt} · ${bed}番ベッド`;
      case 'ru': return `${roomFmt} · Кровать ${bed}`;
      case 'es': return `${roomFmt} · Cama ${bed}`;
      case 'ko':
      default:   return `${roomFmt} · ${bed}번`;
    }
  }

  // ── 키보드 레이아웃 ───────────────────────────────────────────
  const KB_LAYOUTS = {
    ko: [
      ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],
      ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],
      ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'],
      ['ㅃ','ㅉ','ㄸ','ㄲ','ㅆ','ㅒ','ㅖ'],
    ],
    en: [
      ['q','w','e','r','t','y','u','i','o','p'],
      ['a','s','d','f','g','h','j','k','l'],
      ['⇧','z','x','c','v','b','n','m'],
    ],
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

  // ── 한글 자모 데이터 (Unicode 한글 음절 = 0xAC00 + (cho*21+jung)*28 + jong) ──
  const HANGUL_CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const HANGUL_JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const HANGUL_JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const VOWEL_COMBO = {
    'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ',
    'ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ',
    'ㅡㅣ':'ㅢ',
  };
  const JONG_COMBO = {
    'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ',
    'ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ',
    'ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ',
    'ㅂㅅ':'ㅄ',
  };
  const JONG_SPLIT = {
    'ㄳ':['ㄱ','ㅅ'],'ㄵ':['ㄴ','ㅈ'],'ㄶ':['ㄴ','ㅎ'],
    'ㄺ':['ㄹ','ㄱ'],'ㄻ':['ㄹ','ㅁ'],'ㄼ':['ㄹ','ㅂ'],
    'ㄽ':['ㄹ','ㅅ'],'ㄾ':['ㄹ','ㅌ'],'ㄿ':['ㄹ','ㅍ'],'ㅀ':['ㄹ','ㅎ'],
    'ㅄ':['ㅂ','ㅅ'],
  };
  const VOWEL_SPLIT = (() => {
    const m = {};
    for (const [k, v] of Object.entries(VOWEL_COMBO)) m[v] = [k[0], k[1]];
    return m;
  })();

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

  // ── 한글 조합 함수 (must be after let hangul declaration; they're closures) ──
  // Note: refer to module-scope `hangul` and `hangulCommitted` declared later
  function hangulCompose() {
    if (hangul.cho < 0) return '';
    if (hangul.jung < 0) return HANGUL_CHO[hangul.cho];
    return String.fromCharCode(0xAC00 + (hangul.cho * 21 + hangul.jung) * 28 + hangul.jong);
  }
  function hangulRender() {
    if (msgInput) msgInput.value = hangulCommitted + hangulCompose();
  }
  function hangulCommit() {
    hangulCommitted += hangulCompose();
    hangul = { cho: -1, jung: -1, jong: 0 };
  }
  function hangulInput(jamo) {
    const choIdx = HANGUL_CHO.indexOf(jamo);
    const jungIdx = HANGUL_JUNG.indexOf(jamo);
    if (jungIdx >= 0) {
      // 모음
      if (hangul.cho < 0) {
        hangulCommit();
        hangulCommitted += jamo;
        hangulRender();
        return;
      }
      if (hangul.jung < 0) {
        hangul.jung = jungIdx;
        hangulRender();
        return;
      }
      if (hangul.jong === 0) {
        const combo = VOWEL_COMBO[HANGUL_JUNG[hangul.jung] + jamo];
        if (combo) {
          hangul.jung = HANGUL_JUNG.indexOf(combo);
          hangulRender();
          return;
        }
        hangulCommit();
        hangulCommitted += jamo;
        hangulRender();
        return;
      }
      // jong 있음 → jong을 다음 음절 cho로 이동
      const prevJong = HANGUL_JONG[hangul.jong];
      const split = JONG_SPLIT[prevJong];
      if (split) {
        hangul.jong = HANGUL_JONG.indexOf(split[0]);
        const newCho = HANGUL_CHO.indexOf(split[1]);
        hangulCommit();
        hangul = { cho: newCho, jung: jungIdx, jong: 0 };
      } else {
        const newCho = HANGUL_CHO.indexOf(prevJong);
        hangul.jong = 0;
        hangulCommit();
        hangul = { cho: newCho >= 0 ? newCho : -1, jung: jungIdx, jong: 0 };
      }
      hangulRender();
      return;
    }
    if (choIdx >= 0) {
      // 자음
      if (hangul.cho < 0) {
        hangul.cho = choIdx;
        hangulRender();
        return;
      }
      if (hangul.jung < 0) {
        hangulCommit();
        hangul.cho = choIdx;
        hangulRender();
        return;
      }
      // cho+jung 있음 → jong에 시도
      const jongIdx = HANGUL_JONG.indexOf(jamo);
      if (hangul.jong === 0) {
        if (jongIdx > 0) {
          hangul.jong = jongIdx;
          hangulRender();
          return;
        }
        hangulCommit();
        hangul.cho = choIdx;
        hangulRender();
        return;
      }
      // jong 이미 있음 → 겹받침 시도
      const combo = JONG_COMBO[HANGUL_JONG[hangul.jong] + jamo];
      if (combo) {
        hangul.jong = HANGUL_JONG.indexOf(combo);
        hangulRender();
        return;
      }
      hangulCommit();
      hangul.cho = choIdx;
      hangulRender();
    }
  }
  function hangulFlush() {
    hangulCommit();
    if (msgInput) {
      hangulCommitted = '';
    }
  }
  function hangulBackspace() {
    if (hangul.jong > 0) {
      const cur = HANGUL_JONG[hangul.jong];
      const split = JONG_SPLIT[cur];
      hangul.jong = split ? HANGUL_JONG.indexOf(split[0]) : 0;
    } else if (hangul.jung >= 0) {
      const cur = HANGUL_JUNG[hangul.jung];
      const split = VOWEL_SPLIT[cur];
      hangul.jung = split ? HANGUL_JUNG.indexOf(split[0]) : -1;
    } else if (hangul.cho >= 0) {
      hangul.cho = -1;
    } else {
      hangulCommitted = hangulCommitted.slice(0, -1);
    }
    hangulRender();
  }
  function hangulReset() {
    hangul = { cho: -1, jung: -1, jong: 0 };
    hangulCommitted = '';
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
    .msg.typing  {
      align-self: flex-start; background: #f1f5f9;
      border-bottom-left-radius: 4px;
      display: flex; gap: 4px; align-items: center;
      padding: 10px 14px;
    }
    .msg.typing span {
      width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;
      animation: typing-bounce 1.2s infinite ease-in-out;
    }
    .msg.typing span:nth-child(2) { animation-delay: 0.15s; }
    .msg.typing span:nth-child(3) { animation-delay: 0.30s; }
    @keyframes typing-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30%           { transform: translateY(-4px); opacity: 1; }
    }

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
    #bed-btns-wrap { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
    #bed-btns-wrap.hidden { display: none; }
    #bed-btns { display: flex; flex-wrap: wrap; gap: 8px; }
    #bed-back {
      align-self: flex-start; font-size: 12px; color: #64748b;
      background: none; border: none; cursor: pointer; padding: 2px 0;
      text-decoration: underline;
    }
    .room-btn, .bed-btn {
      padding: 9px 14px; border-radius: 10px; border: 1.5px solid #e2e8f0;
      background: white; color: #1e293b; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: border-color 0.15s, background 0.15s;
    }
    .room-btn:hover, .bed-btn:hover { border-color: #2563eb; background: #eff6ff; color: #2563eb; }
    #name-gate {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px 20px; gap: 14px;
    }
    #name-gate.hidden { display: none; }
    #name-gate > p { font-size: 15px; font-weight: 600; color: #334155; }
    #name-input {
      width: 100%; padding: 11px 14px; border: 1.5px solid #e2e8f0;
      border-radius: 10px; font-size: 16px; outline: none; color: #1e293b;
      box-sizing: border-box; text-align: center;
    }
    #name-input:focus { border-color: #2563eb; }
    #name-submit {
      width: 100%; padding: 12px; border-radius: 10px;
      background: #2563eb; color: white; border: none;
      font-size: 15px; font-weight: 600; cursor: pointer;
    }
    #name-submit:hover { background: #1d4ed8; }
    #name-error { font-size: 13px; color: #ef4444; }
    #name-error.hidden { display: none; }
    #name-kb-hint {
      font-size: 12px; color: #64748b; text-align: center;
      margin-top: -4px;
    }
    #name-kb-hint.hidden { display: none; }

    /* 키오스크 stage-gate (체크인 전 / 방번호 선택) */
    #kiosk-stage-gate {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 20px; gap: 14px;
    }
    #kiosk-stage-gate.hidden { display: none; }
    #kiosk-stage-gate p {
      font-size: 16px; font-weight: 600; color: #334155;
      text-align: center; margin-bottom: 4px;
    }
    .stage-btn {
      width: 100%; max-width: 320px; padding: 16px 18px;
      border-radius: 12px; border: 2px solid #2563eb;
      background: white; color: #1e3a8a; font-size: 15px;
      font-weight: 600; cursor: pointer; line-height: 1.3;
      transition: background 0.15s;
    }
    .stage-btn:hover { background: #eff6ff; }

    ${IS_KIOSK ? `
    /* ── 키오스크 하단 드로어 모드 (세로 모니터 최적화) ───────── */
    #chat-box {
      position: fixed; left: 0; right: 0; bottom: 0; top: auto;
      width: 100%; height: 40vh; max-height: 40vh;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -4px 16px rgba(0,0,0,0.15);
      transform: none;
      transition: opacity 0.2s, transform 0.25s ease;
    }
    /* 닫혔을 때 — 화면 아래로 슬라이드 다운 */
    #chat-box.hidden {
      opacity: 0; pointer-events: none;
      transform: translateY(100%) !important;
    }
    #chat-box.kb-open { height: 40vh; bottom: 0; }

    /* 키오스크 전용 — 키보드 키 크게, 폭 충분히 활용 */
    #virtual-kb { padding: 8px 8px 6px; }
    .kb-key {
      min-width: 50px !important; height: 65px !important;
      max-width: none !important; font-size: 24px !important;
      padding: 0 8px !important;
    }
    #kb-space { height: 56px !important; font-size: 16px !important; }
    #kb-back  { height: 56px !important; width: 70px !important; font-size: 22px !important; }
    #kb-send  { height: 56px !important; width: 90px !important; font-size: 16px !important; }
    .vk-cand-char { font-size: 20px !important; padding: 6px 12px !important; }
    #lang-bar { padding: 8px 12px; }
    .lang-btn { padding: 6px 14px; font-size: 14px; }
    ` : ''}
  `;

  // ── currentLang 초기화 (HTML 템플릿보다 먼저 선언) ──────────────
  let currentLang = IS_KIOSK
    ? (sessionStorage.getItem(KIOSK_LANG_KEY) || 'ko')
    : (new URLSearchParams(window.location.search).get('lang') || 'ko');

  // ── HTML ──────────────────────────────────────────────────────
  function _ti(key) {
    return (WIDGET_TEXT[currentLang] || WIDGET_TEXT.ko)[key] || '';
  }

  const container = document.createElement('div');
  container.innerHTML = `
    <button id="toggle-btn" aria-label="${_ti('toggleAriaLabel')}">💬</button>
    <div id="chat-box" class="hidden">
      <div id="chat-header">
        <div id="status-dot"></div>
        <div id="title-wrap">
          <span id="title">${_ti('brandTitle')}</span>
          <span id="status-text">${_ti('statusAuto')}</span>
        </div>
        <button id="close-btn">${_ti('closeBtnLabel')}</button>
      </div>
      <div id="close-confirm" class="hidden">
        <p>${_ti('closeConfirm')}</p>
        <div class="confirm-btns">
          <button id="confirm-yes">${_ti('closeConfirmYes')}</button>
          <button id="confirm-no">${_ti('closeConfirmNo')}</button>
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
      </div>
      <div id="kiosk-stage-gate" class="hidden">
        <p id="kiosk-stage-title">${_ti('kioskStageTitle')}</p>
        <button id="stage-pre-checkin" class="stage-btn">🛬 ${_ti('kioskStagePreCheckin')}</button>
        <button id="stage-post-checkin" class="stage-btn">🏠 ${_ti('kioskStagePostCheckin')}</button>
      </div>` : ''}
      <div id="checkout-gate" class="hidden">
        <p>${_ti('checkoutTitle')}</p>
        <input id="checkout-date" type="date" lang="${currentLang}" />
        <button id="checkout-submit">${_ti('checkoutNext')}</button>
        <p id="checkout-blocked" class="hidden">${_ti('checkoutBlockedMsg')}</p>
      </div>
      ${(IS_QR_MODE || IS_KIOSK) ? `
      <div id="room-gate" class="hidden">
        <p id="room-gate-title">${_ti('roomGateTitle')}</p>
        <div id="room-grid"></div>
        <div id="bed-btns-wrap" class="hidden">
          <div id="bed-btns"></div>
          <button id="bed-back">${_ti('bedBack')}</button>
        </div>
      </div>
      <div id="name-gate" class="hidden">
        <p id="name-gate-title">${_ti('nameTitle')}</p>
        <p id="name-kb-hint" class="${IS_KIOSK ? '' : 'hidden'}">${_ti('nameKbHint')}</p>
        <input id="name-input" type="text" placeholder="${_ti('namePlaceholder')}" maxlength="20" />
        <button id="name-submit">${_ti('nameSubmitBtn')}</button>
        <p id="name-error" class="hidden">${_ti('nameErrorMsg')}</p>
      </div>` : ''}
      <div id="messages"></div>
      <div id="candidates-box"></div>
      <button id="escalate-btn">${_ti('escalateBtn')}</button>
      ${IS_KIOSK ? `
      <div id="virtual-kb" class="hidden">
        <div id="vk-candidates"></div>
        <div id="kb-rows"></div>
        <div id="kb-actions">
          <button id="kb-space">SPACE</button>
          <button id="kb-back">⌫</button>
          <button id="kb-send">${_ti('kbSend')}</button>
        </div>
      </div>` : ''}
      <div id="input-area">
        <input id="msg-input" type="text" placeholder="${_ti('placeholder')}" />
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
  const _GATES_ENABLED  = IS_QR_MODE || IS_KIOSK;
  const roomGate        = _GATES_ENABLED ? shadow.getElementById('room-gate') : null;
  const roomGrid        = _GATES_ENABLED ? shadow.getElementById('room-grid') : null;
  const roomGateTitle   = _GATES_ENABLED ? shadow.getElementById('room-gate-title') : null;
  const bedBtnsWrap     = _GATES_ENABLED ? shadow.getElementById('bed-btns-wrap') : null;
  const bedBtns         = _GATES_ENABLED ? shadow.getElementById('bed-btns') : null;
  const bedBack         = _GATES_ENABLED ? shadow.getElementById('bed-back') : null;
  const nameGate        = _GATES_ENABLED ? shadow.getElementById('name-gate') : null;
  const nameInput       = _GATES_ENABLED ? shadow.getElementById('name-input') : null;
  const nameSubmit      = _GATES_ENABLED ? shadow.getElementById('name-submit') : null;
  const nameError       = _GATES_ENABLED ? shadow.getElementById('name-error') : null;
  const nameGateTitle   = _GATES_ENABLED ? shadow.getElementById('name-gate-title') : null;
  const nameKbHint      = _GATES_ENABLED ? shadow.getElementById('name-kb-hint') : null;
  // 키오스크 게이트 전용
  const langBar         = IS_KIOSK ? shadow.getElementById('lang-bar') : null;
  const kioskStageGate  = IS_KIOSK ? shadow.getElementById('kiosk-stage-gate') : null;
  const kioskStageTitle = IS_KIOSK ? shadow.getElementById('kiosk-stage-title') : null;
  const stagePreBtn     = IS_KIOSK ? shadow.getElementById('stage-pre-checkin') : null;
  const stagePostBtn    = IS_KIOSK ? shadow.getElementById('stage-post-checkin') : null;
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

  let isOpen = false; // 키오스크에서도 토글 버튼 클릭 시 펼침
  // 키오스크 게이트 상태
  let nameGateActive = false;
  let savedChatLang = null;
  let roomId = sessionStorage.getItem(STORAGE_KEY) || null;
  let socket = null;
  let connected = false;
  let currentStatus = 'auto';
  let pinyinBuffer = '';
  let romajiBuffer = '';
  // 한글 조합 버퍼: cho/jung은 -1=비어있음, jong=0=종성없음
  let hangul = { cho: -1, jung: -1, jong: 0 };
  let hangulCommitted = '';
  // 영어 Shift 토글 (대문자 모드)
  let enShiftOn = false;

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

  // ── 키오스크 stage-gate (체크인 전 / 방번호 입력) ───────────
  function showKioskStageGate() {
    if (!kioskStageGate) return;
    hideChat();
    kioskStageGate.classList.remove('hidden');
    if (roomGate) roomGate.classList.add('hidden');
    if (nameGate) nameGate.classList.add('hidden');
    if (kioskStageTitle) kioskStageTitle.textContent = t('kioskStageTitle');
    if (stagePreBtn) stagePreBtn.textContent = '🛬 ' + t('kioskStagePreCheckin');
    if (stagePostBtn) stagePostBtn.textContent = '🏠 ' + t('kioskStagePostCheckin');
    // 게이트 단계에서는 가상 키보드 숨김
    if (virtualKb) virtualKb.classList.add('hidden');
    if (chatBox) chatBox.classList.remove('kb-open');
  }
  function hideKioskStageGate() {
    if (kioskStageGate) kioskStageGate.classList.add('hidden');
  }
  if (stagePreBtn) {
    stagePreBtn.addEventListener('click', () => {
      // 체크인 전: roomLabel sentinel = 'PRE_CHECKIN'
      sessionStorage.setItem(ROOM_KEY, 'PRE_CHECKIN');
      hideKioskStageGate();
      showNameGate('PRE_CHECKIN');
    });
  }
  if (stagePostBtn) {
    stagePostBtn.addEventListener('click', () => {
      hideKioskStageGate();
      showRoomGate();
    });
  }

  // ── 방 번호 게이트 (QR 모드 + 키오스크 공유) ────────────────
  function hideChat() {
    messagesEl.style.display = 'none';
    candidatesBox.style.display = 'none';
    escalateBtn.style.display = 'none';
    inputArea.style.display = 'none';
  }
  function showChat() {
    messagesEl.style.display = '';
    candidatesBox.style.display = '';
    escalateBtn.style.display = '';
    inputArea.style.display = '';
  }

  function showRoomGate() {
    if (!roomGate) return;
    hideChat();
    nameGate.classList.add('hidden');
    roomGate.classList.remove('hidden');
    roomGateTitle.textContent = t('roomGateTitle');
    roomGrid.style.display = '';
    bedBtnsWrap.classList.add('hidden');

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
    // 방 그리드 숨기고 침대 선택만 표시
    roomGrid.style.display = 'none';
    const bedTitleSuffix = {
      ko: ' — 침대 번호를 선택해주세요',
      en: ' — Select your bed number',
      zh: ' — 请选择床位编号',
      ja: ' — ベッド番号を選択してください',
      ru: ' — Выберите номер кровати',
      es: ' — Selecciona tu número de cama',
    };
    roomGateTitle.textContent = formatRoomLabel(room.label, currentLang)
      + (bedTitleSuffix[currentLang] || bedTitleSuffix.ko);
    bedBtns.innerHTML = '';
    for (let i = 1; i <= room.beds; i++) {
      const btn = document.createElement('button');
      btn.className = 'bed-btn';
      btn.textContent = t('bedUnit') ? `${i}${t('bedUnit')}` : String(i);
      btn.addEventListener('click', () => finishRoomGate(room.label + '-' + i));
      bedBtns.appendChild(btn);
    }
    bedBtnsWrap.classList.remove('hidden');
  }

  if (bedBack) {
    bedBack.addEventListener('click', showRoomGate);
  }

  function hideRoomGate() {
    if (!roomGate) return;
    roomGate.classList.add('hidden');
  }

  function finishRoomGate(label) {
    sessionStorage.setItem(ROOM_KEY, label);
    hideRoomGate();
    showNameGate(label);
  }

  // ── 이름 입력 게이트 (QR 모드 + 키오스크 공유) ────────────
  function showNameGate(roomLabel) {
    hideChat();
    if (!nameGate) return;
    nameGate.classList.remove('hidden');
    nameInput.value = sessionStorage.getItem(NAME_KEY) || '';
    nameError.classList.add('hidden');
    if (nameGateTitle) nameGateTitle.textContent = t('nameTitle');

    if (IS_KIOSK) {
      // 영어 키보드 강제 + 언어 탭 숨김
      nameGateActive = true;
      savedChatLang = currentLang;
      if (langBar) langBar.style.display = 'none';
      if (nameKbHint) {
        nameKbHint.textContent = t('nameKbHint');
        nameKbHint.classList.remove('hidden');
      }
      // 가상 키보드 영어로 강제 표시
      if (virtualKb) {
        virtualKb.classList.remove('hidden');
        if (chatBox) chatBox.classList.add('kb-open');
      }
      enShiftOn = false; // 시작은 소문자
      renderKeyboard('en');
      // 모바일 OS 키보드 차단 (가상 키보드만 사용)
      nameInput.setAttribute('inputmode', 'none');
    } else {
      nameInput.focus();
    }
  }

  function hideNameGate() {
    if (nameGate) nameGate.classList.add('hidden');
  }

  function handleNameSubmit() {
    const name = nameInput.value.trim();
    if (!name) {
      nameError.classList.remove('hidden');
      return;
    }
    sessionStorage.setItem(NAME_KEY, name);
    hideNameGate();

    if (IS_KIOSK) {
      // 언어 탭 복귀 + 원래 채팅 언어로 키보드 복구
      nameGateActive = false;
      if (langBar) langBar.style.display = '';
      if (nameKbHint) nameKbHint.classList.add('hidden');
      if (savedChatLang) {
        currentLang = savedChatLang;
        savedChatLang = null;
      }
      // 채팅 언어 키보드 다시 그리기
      switchLang(currentLang);
    }

    showChat();
    if (!connected) connectSocket();
    else if (!roomId) socket.emit('guest:join', {
      guestId: getGuestId(),
      roomLabel: sessionStorage.getItem(ROOM_KEY) || '',
      guestName: name,
    });
  }

  if (nameSubmit) {
    nameSubmit.addEventListener('click', handleNameSubmit);
    nameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleNameSubmit(); });
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
        // 영어: Shift 키는 상태에 따라 시각적 활성화, 일반 글자는 대/소문자 표시
        if (lang === 'en') {
          if (key === '⇧') {
            btn.textContent = '⇧';
            if (enShiftOn) btn.style.background = '#bfdbfe';
          } else {
            btn.textContent = enShiftOn ? key.toUpperCase() : key;
          }
        } else {
          btn.textContent = key;
        }
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          handleKeyPress(key, lang);
        });
        rowEl.appendChild(btn);
      });
      kbRows.appendChild(rowEl);
    });
  }

  // 가상 키보드 타겟 입력란 — 키오스크 이름 게이트일 때만 nameInput, 그 외는 msgInput
  function getKeyboardTarget() {
    return (IS_KIOSK && nameGateActive && nameInput) ? nameInput : msgInput;
  }

  function handleKeyPress(key, lang) {
    const target = getKeyboardTarget();
    if (lang === 'ko') {
      hangulInput(key);
    } else if (lang === 'en') {
      if (key === '⇧') {
        enShiftOn = !enShiftOn;
        renderKeyboard('en');
      } else {
        target.value += enShiftOn ? key.toUpperCase() : key;
      }
    } else if (lang === 'ru') {
      target.value += key.toLowerCase();
    } else if (lang === 'es') {
      // QWERTY row: lowercase; special chars: already lowercase/correct
      target.value += /^[A-Z]$/.test(key) ? key.toLowerCase() : key;
    } else if (lang === 'zh') {
      if (/^[A-Z]$/.test(key)) {
        pinyinBuffer += key.toLowerCase();
        updateZhCandidates();
      } else {
        target.value += key;
      }
    } else if (lang === 'ja') {
      if (/^[A-Z]$/.test(key)) {
        romajiBuffer += key.toLowerCase();
        updateJaCandidates();
      } else {
        target.value += key;
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
    if (currentLang === 'ko') {
      // 이중 호출 방어: 조합 중도 아니고 prefix도 비어있으면 no-op
      // (sendMessage가 내부적으로 flushBuffers를 다시 부를 때 msgInput을 지우는 버그 방지)
      if (hangul.cho < 0 && hangul.jung < 0 && !hangulCommitted) {
        // 할 일 없음
      } else {
        hangulCommit();
        if (msgInput) msgInput.value = hangulCommitted;
        hangulCommitted = '';
      }
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

    // 헤더 타이틀 — 방번호/이름 있으면 brandTitle · 방 · 이름, 없으면 brandTitle
    if (titleEl) {
      const lbl = sessionStorage.getItem(ROOM_KEY);
      const nm  = sessionStorage.getItem(NAME_KEY);
      if (IS_QR_MODE && (lbl || nm)) {
        const parts = [t('brandTitle')];
        if (lbl) parts.push(formatRoomLabel(lbl, currentLang));
        if (nm)  parts.push(nm);
        titleEl.textContent = parts.join(' · ');
      } else {
        titleEl.textContent = t('brandTitle');
      }
    }

    // 토글 버튼 aria-label
    if (toggleBtn) toggleBtn.setAttribute('aria-label', t('toggleAriaLabel'));

    // QR 게이트 라벨/플레이스홀더
    if (IS_QR_MODE) {
      const checkoutP = checkoutGate?.querySelector('p:first-of-type');
      if (checkoutP) checkoutP.textContent = t('checkoutTitle');
      if (checkoutSubmit) checkoutSubmit.textContent = t('checkoutNext');
      if (checkoutBlocked) checkoutBlocked.textContent = t('checkoutBlockedMsg');
      if (checkoutDate) checkoutDate.setAttribute('lang', currentLang);
      if (roomGateTitle && bedBtnsWrap?.classList.contains('hidden')) {
        // 침대 선택 화면이 아닐 때만 기본 타이틀 갱신
        roomGateTitle.textContent = t('roomGateTitle');
      }
      if (bedBack) bedBack.textContent = t('bedBack');
      const nameP = nameGate?.querySelector('p:first-of-type');
      if (nameP) nameP.textContent = t('nameTitle');
      if (nameSubmit) nameSubmit.textContent = t('nameSubmitBtn');
      if (nameError) nameError.textContent = t('nameErrorMsg');
      if (nameInput) nameInput.placeholder = t('namePlaceholder');
    }
  }

  function switchLang(lang) {
    // ko에서 다른 언어로 떠날 때 마지막 음절 확정 후 hangul 상태 비우기
    if (currentLang === 'ko' && lang !== 'ko' && msgInput) {
      hangulCommit();
      msgInput.value = hangulCommitted;
      hangulCommitted = '';
      hangul = { cho: -1, jung: -1, jong: 0 };
    }

    currentLang = lang;
    sessionStorage.setItem(KIOSK_LANG_KEY, lang);

    shadow.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    pinyinBuffer = '';
    romajiBuffer = '';
    // ko로 들어올 때 input 텍스트를 hangulCommitted에 동기화
    if (lang === 'ko' && msgInput) {
      hangulCommitted = msgInput.value;
      hangul = { cho: -1, jung: -1, jong: 0 };
    } else {
      hangulReset();
    }
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
      const target = getKeyboardTarget();
      if (target === nameInput) {
        target.value += ' ';
        return;
      }
      flushBuffers();
      target.value += ' ';
    });

    kbBack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const target = getKeyboardTarget();
      if (target === nameInput) {
        target.value = target.value.slice(0, -1);
        return;
      }
      if (currentLang === 'zh' && pinyinBuffer) {
        pinyinBuffer = pinyinBuffer.slice(0, -1);
        updateZhCandidates();
      } else if (currentLang === 'ja' && romajiBuffer) {
        romajiBuffer = romajiBuffer.slice(0, -1);
        updateJaCandidates();
      } else if (currentLang === 'ko') {
        hangulBackspace();
      } else {
        msgInput.value = msgInput.value.slice(0, -1);
      }
    });

    kbSend.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // 이름 게이트에서는 이름 제출, 그 외는 메시지 전송
      if (IS_KIOSK && nameGateActive) {
        handleNameSubmit();
        return;
      }
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

  // ── 입력 중(typing) 인디케이터 ────────────────────────────────
  let typingEl = null;
  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'msg typing';
    typingEl.setAttribute('aria-label', 'typing');
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  function showCandidates(candidates) {
    candidatesBox.innerHTML = '';
    if (!candidates || candidates.length === 0) return;
    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:4px;padding:8px 0 0;';
    label.textContent = t('candidatesLabel');
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
      sessionStorage.removeItem(NAME_KEY);
      if (titleEl) titleEl.textContent = t('brandTitle');
    }
    if (IS_KIOSK) {
      // 키오스크는 ✕ 닫을 때마다 게이트 상태 초기화 — 다음 손님이 새로 시작
      sessionStorage.removeItem(ROOM_KEY);
      sessionStorage.removeItem(NAME_KEY);
      nameGateActive = false;
      savedChatLang = null;
      if (langBar) langBar.style.display = '';
      if (nameKbHint) nameKbHint.classList.add('hidden');
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
          guestName: sessionStorage.getItem(NAME_KEY) || '',
        });
      });

      socket.on('room:created', ({ roomId: rid, status }) => {
        const isNewRoom = rid !== roomId;
        roomId = rid;
        sessionStorage.setItem(STORAGE_KEY, rid);
        updateStatus(status || 'auto');
        // QR 모드: 헤더에 방 번호 + 이름 표시
        if (IS_QR_MODE && titleEl) {
          const lbl = sessionStorage.getItem(ROOM_KEY);
          const nm  = sessionStorage.getItem(NAME_KEY);
          const parts = [t('brandTitle')];
          if (lbl) parts.push(formatRoomLabel(lbl, currentLang));
          if (nm)  parts.push(nm);
          titleEl.textContent = parts.join(' · ');
        }
        if (isNewRoom && messagesEl.children.length === 0) {
          appendMsg(t('welcome'), 'system');
        }
      });

      socket.on('room:status', ({ status }) => {
        updateStatus(status);
      });

      socket.on('auto:typing', ({ on }) => {
        if (on) showTyping(); else hideTyping();
      });

      socket.on('auto:response', ({ content, requiresHandoff }) => {
        hideTyping();
        candidatesBox.innerHTML = '';
        appendMsg(content, 'auto');
        // 직원 확인이 필요한 사안은 자동응답 후에도 매니저 연결 버튼 노출
        if (requiresHandoff) {
          escalateBtn.classList.add('visible');
        } else {
          escalateBtn.classList.remove('visible');
        }
      });

      socket.on('auto:candidates', ({ candidates }) => {
        escalateBtn.classList.remove('visible');
        showCandidates(candidates);
      });

      socket.on('auto:escalate', () => {
        hideTyping();
        candidatesBox.innerHTML = '';
        escalateBtn.classList.add('visible');
        appendMsg(t('escalateOffer'), 'system');
      });

      socket.on('manager:message', ({ content, translated, originalLang }) => {
        if (translated) {
          // 매니저가 중국어로 답한 걸 손님 언어로 자동 번역 — 번역문을 메인으로
          appendMsg(translated, 'manager');
          // 중국어 원문은 그 아래 작게 표시 (참고용)
          const sub = document.createElement('div');
          sub.className = 'msg-translation-source';
          sub.textContent = content;
          sub.style.cssText =
            'align-self:flex-start;max-width:80%;margin:-4px 0 6px 4px;' +
            'font-size:11px;color:#94a3b8;line-height:1.4;';
          messagesEl.appendChild(sub);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } else {
          appendMsg(content, 'manager');
        }
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
    // 키오스크 하단 드로어 펼쳐졌을 때 토글 버튼이 가려지지 않게 위로 이동
    if (IS_KIOSK) {
      toggleBtn.style.bottom = isOpen ? 'calc(40vh + 16px)' : '24px';
    }
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
        if (!savedRoom) { showRoomGate(); return; }
        hideRoomGate();
        const savedName = sessionStorage.getItem(NAME_KEY);
        if (!savedName) { showNameGate(savedRoom); return; }
        hideNameGate();
        showChat();
      } else if (IS_KIOSK) {
        switchLang(currentLang);
        // 키오스크 게이트: 방 라벨/이름이 모두 있어야 채팅 진입
        const savedRoom = sessionStorage.getItem(ROOM_KEY);
        const savedName = sessionStorage.getItem(NAME_KEY);
        if (!savedRoom) { showKioskStageGate(); return; }
        if (!savedName) { showNameGate(savedRoom); return; }
        // 둘 다 있으면 채팅 진입
        hideKioskStageGate();
        if (roomGate) roomGate.classList.add('hidden');
        if (nameGate) nameGate.classList.add('hidden');
        showChat();
      }
      if (!connected) connectSocket();
      else if (!roomId) socket.emit('guest:join', {
        guestId: getGuestId(),
        roomLabel: sessionStorage.getItem(ROOM_KEY) || '',
        guestName: sessionStorage.getItem(NAME_KEY) || '',
      });
      if (!VIRTUAL_KB_LANGS.includes(currentLang)) msgInput.focus();
    }
  });

  function sendMessage() {
    flushBuffers();
    const content = msgInput.value.trim();
    if (!content || !roomId || currentStatus === 'closed') return;
    appendMsg(content, 'guest');
    socket.emit('guest:send_message', { roomId, content, lang: currentLang });
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
    // 키오스크: 다음 손님을 위해 게이트 상태도 초기화
    if (IS_KIOSK) {
      sessionStorage.removeItem(ROOM_KEY);
      sessionStorage.removeItem(NAME_KEY);
      nameGateActive = false;
      savedChatLang = null;
      if (langBar) langBar.style.display = '';
      if (nameKbHint) nameKbHint.classList.add('hidden');
    }
  });
})();
