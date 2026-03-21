// ==============================================
// 1. 전역 데이터: 예약 데이터, 비밀번호
// ==============================================

let reservationData = new Map();

// 예약 검색 실패 누적 카운터 (이 화면에서만 유지)
let reservationSearchFailCount = 0;

// 비밀번호 데이터 (passwords.json에서 로드)
let roomPasswords = {};
let lockerPasswords = {};

// 데이터 로드 성공 여부 추적
let excelLoadSuccess = false;

let i18n;

// 이번 예약에서 비번/영상 존재 여부 기억
let lastHasRoomPassword = false;
let lastHasLockerPassword = false;
let lastHasCheckInInstructionVideo = false;

// ==============================================
// 1-1. 안내 음성 재생 시스템 (다국어 확장 가능)
// ==============================================

// 현재 재생 중인 Audio 객체를 추적 (중복 재생 방지용)
let currentGuideAudio = null;

// 언어별 + 단계별 음성 파일 매핑 테이블
// - "name": 이름이 테이블에 표시될 때
// - "room_private": 개인실(하이픈 없는 방) 방번호 표시
// - "room_dorm": 도미토리(하이픈 있는 방) 방번호 표시
// - "password_private": 개인실 비밀번호 표시
// - "password_dorm": 도미토리 방/사물함 비밀번호 표시
// - "checkout": 체크아웃 날짜 표시
// - "method": 체크인 방법 정보 표시
const GUIDE_AUDIO_MAP = {
  zh: {
    name: "02_zh_check_name.m4a",
    room_private: "03_zh_check_room_number.m4a",
    room_dorm: "04_zh_check_room_and_bed_number.m4a",
    password_private: "05_zh_check_password.m4a",
    password_dorm: "06_zh_check_room_and_locker_password.m4a",
    checkout: "07_zh_check_checkout_date.m4a",
    method: "08_zh_room_slippers_and_amenities.m4a"
  }
  // ★ 다른 언어 추가 시 여기에 블록 추가 (예: en: { name: "...", ... })
};

// 안내 음성 재생 함수
// guideKey: GUIDE_AUDIO_MAP의 키 (예: "name", "room_private")
function playGuideAudio(guideKey) {
  // 기존 재생 중인 음성이 있으면 정지
  stopGuideAudio();

  // 현재 언어 가져오기
  const lang = getLanguageFromURL();

  // 해당 언어의 매핑이 없으면 재생하지 않음
  const langMap = GUIDE_AUDIO_MAP[lang];
  if (!langMap) return;

  // 해당 단계의 파일이 없으면 재생하지 않음
  const fileName = langMap[guideKey];
  if (!fileName) return;

  // Audio 객체 생성 및 재생
  const audio = new Audio(`../audio/${fileName}`);
  currentGuideAudio = audio;
  audio.play().catch(e => console.warn("[GuideAudio] 재생 실패:", e));
}

// 안내 음성 정지 함수
function stopGuideAudio() {
  if (currentGuideAudio) {
    currentGuideAudio.pause();
    currentGuideAudio = null;
  }
}

// ==============================================
// 2. URL lang 파라미터
// ==============================================
// ==============================================
// 2. i18n 로드 (공통 loadI18n은 i18n.js 참조, 텍스트 치환 t() 함수 포함)
// ==============================================
async function loadLanguageData() {
  i18n = await loadI18n("../data/reservation_number.json");
  return !!i18n;
}

// ==============================================
// 3. 엑셀 로드
// ==============================================
async function loadExcelData() {
  try {
    const res = await fetch(CONFIG.EXCEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sh = wb.Sheets[wb.SheetNames[0]];
    if (!sh["!ref"]) throw new Error("엑셀 데이터 비어 있음");

    const cols = CONFIG.EXCEL_COLUMNS;
    const range = XLSX.utils.decode_range(sh["!ref"]);
    reservationData.clear();

    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const nameCell = sh[XLSX.utils.encode_cell({ r, c: cols.guestName })];
      const resCell = sh[XLSX.utils.encode_cell({ r, c: cols.reservationNumber })];
      const roomCell = sh[XLSX.utils.encode_cell({ r, c: cols.roomNumber })];
      const outCell = sh[XLSX.utils.encode_cell({ r, c: cols.checkOutDate })];

      if (nameCell && resCell && roomCell && outCell) {
        const reservationNumber = resCell.v.toString().trim().toUpperCase();
        const roomNumber = roomCell.v.toString().trim();
        const checkOutDate = outCell.v.toString().trim();

        reservationData.set(reservationNumber, {
          name: nameCell.v.trim().replace(/\s+/g, " "),
          reservation_number: reservationNumber,
          room_number: roomNumber,
          check_out_date: checkOutDate
        });
      }
    }
    excelLoadSuccess = true;
  } catch (e) {
    console.error("엑셀 로드 오류:", e);
    excelLoadSuccess = false;
    showDataLoadError();
  }
}

/**
 * 예약 데이터 로드 실패 시 화면에 에러 배너를 표시합니다.
 * i18n이 로드된 경우 다국어 메시지를, 아닌 경우 4개 언어 fallback을 사용합니다.
 */
function showDataLoadError() {
  // i18n이 이미 로드된 경우 → 해당 언어 메시지 사용
  const msg = i18n?.loadError ||
    // i18n 로드도 실패한 최악의 경우 → 4개 언어 동시 표시
    "예약 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.\n" +
    "Failed to load reservation data. Please try again later.\n" +
    "无法加载预订数据，请稍后再试。\n" +
    "予約データを読み込めませんでした。しばらくしてから再試行してください。";

  // 기존 에러 배너가 있으면 제거
  const existing = document.getElementById("dataLoadErrorBanner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "dataLoadErrorBanner";
  banner.style.cssText = [
    "background:#fff3cd", "color:#856404", "border:2px solid #ffc107",
    "border-radius:8px", "padding:16px 20px", "margin:16px auto",
    "max-width:600px", "font-size:1.1rem", "line-height:1.7",
    "white-space:pre-line", "text-align:center"
  ].join(";");
  banner.textContent = "⚠️  " + msg;

  // 검색 버튼 위에 삽입
  const searchBtn = document.getElementById("searchButton");
  if (searchBtn) {
    searchBtn.parentNode.insertBefore(banner, searchBtn);
  } else {
    document.body.appendChild(banner);
  }
}

// ==============================================
// 4-1. 비밀번호 데이터 로드 (passwords.json)
// ==============================================
async function loadPasswordData() {
  try {
    const res = await fetch(CONFIG.PASSWORDS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    roomPasswords = data.roomPasswords || {};
    lockerPasswords = data.lockerPasswords || {};
  } catch (e) {
    console.error("비밀번호 데이터 로드 오류:", e);
    // 로드 실패해도 빈 객체로 fallback → 비번 없음으로 처리됨
  }
}


function _normBase(s) {
  return s
    ?.normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim() || "";
}
function _noSpace(s) {
  return _normBase(s).replace(/\s/g, "");
}

function matchesName(query, fullName) {
  const q = _normBase(query);
  if (!q) return false;

  const qNo = _noSpace(q);
  const name = _normBase(fullName);
  const nameTokens = name.split(" ").filter(Boolean);
  if (nameTokens.length === 0) return false;

  const joinNoSpace = (arr) => arr.join("");

  const tokenSet = new Set(nameTokens);
  if (tokenSet.has(q)) return true;

  const allFwd = joinNoSpace(nameTokens);
  const allRev = joinNoSpace([...nameTokens].reverse());
  if (qNo === allFwd || qNo === allRev) return true;

  const isLatin = (t) => /^[a-z0-9]+$/i.test(t);
  const isHangul = (t) => /^\p{Script=Hangul}+$/u.test(t);
  const isHan = (t) => /^\p{Script=Han}+$/u.test(t);
  const isHiragana = (t) => /^\p{Script=Hiragana}+$/u.test(t);
  const isKatakana = (t) => /^\p{Script=Katakana}+$/u.test(t);

  const groups = [
    nameTokens.filter(isLatin),
    nameTokens.filter(isHangul),
    nameTokens.filter(isHan),
    nameTokens.filter(isHiragana),
    nameTokens.filter(isKatakana),
  ];

  for (const g of groups) {
    if (g.length >= 1) {
      const fwd = joinNoSpace(g);
      const rev = joinNoSpace([...g].reverse());
      if (qNo === fwd || qNo === rev) return true;
    }
  }

  const qTokens = q.split(" ").filter(Boolean);
  if (qTokens.length > 0) {
    const everyTokenExists = qTokens.every(t => nameTokens.includes(t));
    if (everyTokenExists) return true;
  }

  return false;
}

// ==============================================
// 6. UI 텍스트
// ==============================================

// 객실 동선 분류는 config.js의 CONFIG.BACK_STAIR_ROOMS / CONFIG.FRONT_PASS_ROOMS 사용

function updateUITexts() {
  const headline = document.querySelector(".headline");
  if (headline) headline.innerHTML = i18n.ui.title;

  const searchButton = document.getElementById("searchButton");
  if (searchButton) searchButton.textContent = i18n.ui.nextButton;

  const guideTextEl = document.getElementById("inputGuide");
  if (guideTextEl) {
    const guide = i18n?.ui?.inputGuide;
    if (typeof guide === "string" && guide.trim() !== "") {
      guideTextEl.innerHTML = guide;
      guideTextEl.style.display = "block";
    } else {
      guideTextEl.innerHTML = "";
      guideTextEl.style.display = "none";
    }
  }

  const reservationInput = document.getElementById("reservationInput");
  if (reservationInput && i18n?.ui?.inputPlaceholder) {
    reservationInput.placeholder = i18n.ui.inputPlaceholder;
  }

  const errorMessage = document.getElementById("errorMessage");
  if (errorMessage) {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
    reservationSearchFailCount = 0;
    hideSearchFailHelp();
  }

  const inputField = document.getElementById("reservationInput");
  if (inputField) inputField.value = "";
}

// ==============================================
// 문자열 템플릿 치환 유틸은 i18n.js의 t() 사용
// ==============================================
// ==============================================
// 예약 검색 실패 안내 (4회 이상)
// ==============================================
function showSearchFailHelp() {
  const el = document.getElementById("searchFailHelp");
  if (!el) return;

  const h = i18n?.searchFailHelp || {
    title: "예약을 찾을 수 없는 경우 다음사항을 체크해주세요",
    line1: "야코리아호스텔 [강남점]으로 예약한 경우입니다 (여기는 동대문점입니다)",
    line2: "체크인 날짜가 확실한가요? 다시 한번 확인해주세요",
    line3: "당일 예약일 경우 아직 시스템 업데이트가 안됐을 수 있습니다. 화면 오른쪽 아래 메시지창을 눌러서 ‘직원에게 연결’(Talk to person)이라고 타이핑해주세요"
  };

  el.style.textAlign = "center";
  el.innerHTML = `
    <div style="display:inline-block; text-align:left; color:#000;">
      <div style="color:#d32f2f; font-weight:700; margin-bottom:6px;">
        ${h.title}
      </div>
      <div>
        1. ${h.line1}<br>
        2. ${h.line2}<br>
        3. ${h.line3}
      </div>
    </div>
  `;
  el.style.display = "block";
}



function hideSearchFailHelp() {
  const el = document.getElementById("searchFailHelp");
  if (el) el.style.display = "none";
}


// ==============================================
// 6-1. 인라인 영상(도어락/락커/체크인방법) 제어
// ==============================================
function _hideInlineVideo(prefix) {
  const bar = document.getElementById(prefix.replace("Inline", "") + "Progress");
  if (bar) bar.style.width = "0%";
  const wrap = document.getElementById(prefix + "Wrap");
  const video = document.getElementById(prefix + "Video");
  if (video) {
    video.pause();
    video.currentTime = 0;
    video.onended = null;
  }
  if (wrap) wrap.style.display = "none";
}

function hideDoorVideoInline() { _hideInlineVideo("doorInline"); }
function hideLockerVideoInline() { _hideInlineVideo("lockerInline"); }
function hideCheckInVideoInline() { _hideInlineVideo("checkinInline"); }

function _showInlineVideo(prefix, onDone) {
  const wrap = document.getElementById(prefix + "Wrap");
  const video = document.getElementById(prefix + "Video");

  if (!wrap || !video) {
    if (typeof onDone === "function") onDone();
    return;
  }
  const progressBar = document.getElementById(prefix.replace("Inline", "") + "Progress");

  if (progressBar) {
    video.ontimeupdate = () => {
      if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        progressBar.style.width = percent + "%";
      }
    };
  }

  // ended 핸들러 중복/덮어쓰기 방지용: 기존 핸들러 정리
  video.onended = null;

  // ended 이벤트를 addEventListener로 고정(한 번만 실행)
  video.addEventListener("ended", () => {
    if (progressBar) {
      progressBar.style.width = "100%";
    }
    _hideInlineVideo(prefix);
    if (typeof onDone === "function") onDone();
  }, { once: true });



  // 한 번에 하나만 보이게
  hideDoorVideoInline();
  hideLockerVideoInline();
  hideCheckInVideoInline();

  wrap.style.display = "flex";
  video.currentTime = 0;



  // 1.5초 텀 주기 (unlock -> pause -> delay -> play)
  const unlockPromise = video.play();

  if (unlockPromise && typeof unlockPromise.then === "function") {
    unlockPromise
      .then(() => {
        video.pause();
        video.currentTime = 0;

        setTimeout(() => {
          const p = video.play();
          if (p && typeof p.catch === "function") {
            p.catch(() => { });
          }
        }, 1500);
      })
      .catch(() => { });
  } else {
    video.pause();
    video.currentTime = 0;
    setTimeout(() => {
      try { video.play(); } catch (e) { }
    }, 1500);
  }
}

function showDoorVideoInline(onDone) { _showInlineVideo("doorInline", onDone); }
function showLockerVideoInline(onDone) { _showInlineVideo("lockerInline", onDone); }
function showCheckInVideoInline(onDone) { _showInlineVideo("checkinInline", onDone); }

// ==============================================
// 영상 스킵 시 → 다음 단계로 강제 이동
// ==============================================
function skipVideoAndGoToNextStep() {
  const currentKey = confirmStepOrder[currentConfirmStep];
  const tableEl = document.querySelector("table.confirm-table");

  if (currentKey === "password") {
    // password 단계 영상 스킵 시 checkout 단계로
    const checkoutIndex = confirmStepOrder.indexOf("checkout");
    if (checkoutIndex !== -1) {
      currentConfirmStep = checkoutIndex;
      if (tableEl) updateConfirmStepUI(tableEl);
    }
  } else if (currentKey === "method") {
    // method 단계 영상 스킵 시 바로 버튼 활성화 및 타이머 재시작
    if (tableEl) {
      const methodBtn = tableEl.querySelector('.confirm-row[data-stepkey="method"] .confirm-btn');
      if (methodBtn) methodBtn.disabled = false;
      if (typeof resetConfirmIdleTimer === "function") resetConfirmIdleTimer(tableEl);
    }
  }
}


// ==============================================
// 7. 단계별 확인(Blur + 확인 버튼) 및 유휴 상태 감지
// ==============================================

let confirmIdleTimer = null;

function resetConfirmIdleTimer(tableEl) {
  clearTimeout(confirmIdleTimer);

  if (!tableEl) return;

  // 모든 버튼에서 is-idle 클래스 제거
  const allBtns = tableEl.querySelectorAll(".confirm-btn");
  allBtns.forEach(btn => btn.classList.remove("is-idle"));

  if (currentConfirmStep >= confirmStepOrder.length) return;

  // 6초 후 현재 활성화된 버튼에 is-idle 클래스 추가
  confirmIdleTimer = setTimeout(() => {
    const activeKey = confirmStepOrder[currentConfirmStep];
    const activeRow = tableEl.querySelector(`.confirm-row[data-stepkey="${activeKey}"]`);
    if (activeRow) {
      const activeBtn = activeRow.querySelector(".confirm-btn");
      // 버튼이 활성화 상태일 때만 애니메이션 적용 (동영상 재생 중에는 비활성화 상태임)
      if (activeBtn && !activeBtn.disabled) {
        activeBtn.classList.add("is-idle");
      }
    }
  }, 6000);
}

let confirmStepOrder = [];
let currentConfirmStep = 0;

// 확인 버튼에 들어갈 텍스트를 언어별/단계별로 반환하는 함수입니다.
// isDorm: 도미토리 방인지 여부 (개인방일 경우 버튼 텍스트를 다르게 표시하기 위함)
function getConfirmButtonText(stepKey, isDorm = false) {
  const lang = document.documentElement.lang || "ko";

  const dict = {
    ko: {
      name: "이름 확인",
      // 도미토리면 '방(침대번호) 확인', 개인방이면 '방번호 확인'으로 표시
      room: isDorm ? "방(침대번호) 확인" : "방번호 확인",
      password: "비밀번호 확인",
      checkout: "퇴실 날짜 확인",
      method: "체크인 방법 확인",
      done: "확인 완료"
    },
    en: {
      name: "Check Name",
      room: isDorm ? "Check Room / Bed Number" : "Check Room Number",
      password: "Check Password",
      checkout: "Check Check-out Date",
      method: "Check Check-in Instructions",
      done: "Done"
    },
    ja: {
      name: "名前の確認",
      room: isDorm ? "部屋・ベッド番号の確認" : "部屋番号の確認",
      password: "パスワードの確認",
      checkout: "チェックアウト日の確認",
      method: "チェックイン方法の確認",
      done: "確認完了"
    },
    zh: {
      name: "确认姓名",
      room: isDorm ? "确认房间 / 床位号" : "确认房间号",
      password: "确认密码",
      checkout: "确认退房日期",
      method: "确认入住方式",
      done: "确认完成"
    }
  };

  const table = dict[lang] || dict.en;
  return table[stepKey] || table.done;
}

// 확인 테이블의 각 행(Row)을 생성하는 함수입니다.
function buildConfirmRow(thText, valueHtml, stepKey, isDorm = false) {
  const btnText = getConfirmButtonText(stepKey, isDorm); // 버튼에 들어갈 텍스트 결정
  return `
    <tr class="confirm-row" data-stepkey="${stepKey}">
      <th class="confirm-th">${thText}</th>
      <td class="confirm-td">
        <div class="confirm-cell">
          <div class="confirm-value">${valueHtml}</div>
          <button type="button" class="confirm-btn" data-stepkey="${stepKey}">
            ${btnText}
          </button>
        </div>
      </td>
    </tr>
  `;
}

function applyConfirmStepUI(tableEl) {
  if (!tableEl) return;

  const rows = Array.from(tableEl.querySelectorAll("tr.confirm-row"));
  confirmStepOrder = rows.map(r => r.getAttribute("data-stepkey")).filter(Boolean);
  currentConfirmStep = 0;

  updateConfirmStepUI(tableEl);

  const advanceStep = () => {
    hideDoorVideoInline();
    hideLockerVideoInline();
    hideCheckInVideoInline();

    currentConfirmStep += 1;
    if (currentConfirmStep >= confirmStepOrder.length) {
      finishConfirmSteps(tableEl);
      return;
    }
    updateConfirmStepUI(tableEl);

    // ★ 단계 전환 시 안내 음성 재생
    const newStepKey = confirmStepOrder[currentConfirmStep];

    if (newStepKey === "room") {
      // 개인실(하이픈 없음) vs 도미토리(하이픈 있음) 구분
      // 도미토리 방은 테이블에 "205 (침대번호 1)" 같은 형식으로 표시됨
      const roomCell = tableEl.querySelector('.confirm-row[data-stepkey="room"] .confirm-value');
      const roomText = roomCell ? roomCell.textContent : "";
      // 괄호가 있으면 도미토리(침대번호가 포함된 형식), 아니면 개인실
      const isDormRoom = roomText.includes("(") || roomText.includes("-");
      playGuideAudio(isDormRoom ? "room_dorm" : "room_private");
    } else if (newStepKey === "password") {
      // 사물함 비밀번호가 있으면 도미토리, 없으면 개인실
      playGuideAudio(lastHasLockerPassword ? "password_dorm" : "password_private");
    } else if (newStepKey === "checkout") {
      playGuideAudio("checkout");
    } else if (newStepKey === "method") {
      playGuideAudio("method");
    }

    // method 단계 진입 시 자동 영상 재생
    if (newStepKey === "method" && lastHasCheckInInstructionVideo) {
      const btn = tableEl.querySelector('.confirm-row[data-stepkey="method"] .confirm-btn');
      if (btn) btn.disabled = true;
      showCheckInVideoInline(() => {
        if (btn) btn.disabled = false;
        if (typeof resetConfirmIdleTimer === "function") resetConfirmIdleTimer(tableEl);
      });
    }
  };

  tableEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".confirm-btn");
    if (!btn) return;

    const stepKey = btn.getAttribute("data-stepkey");
    const expectedStepKey = confirmStepOrder[currentConfirmStep];
    if (stepKey !== expectedStepKey) return;

    // password 단계: 도어락 -> (있으면) 락커 -> checkout
    if (stepKey === "password") {
      if (lastHasRoomPassword) {
        btn.disabled = true;
        showDoorVideoInline(() => {
          if (lastHasLockerPassword) {
            showLockerVideoInline(() => {
              advanceStep();
            });
          } else {
            advanceStep();
          }
        });
        return;
      }

      if (lastHasLockerPassword) {
        btn.disabled = true;
        showLockerVideoInline(() => {
          advanceStep();
        });
        return;
      }
    }

    advanceStep();
  });
}

function updateConfirmStepUI(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll("tr.confirm-row"));
  const activeKey = confirmStepOrder[currentConfirmStep];

  rows.forEach((row) => {
    const key = row.getAttribute("data-stepkey");
    const isActive = key === activeKey;

    row.classList.toggle("is-active", isActive);
    row.classList.toggle("is-blurred", !isActive);

    const btn = row.querySelector(".confirm-btn");
    if (btn) btn.disabled = !isActive;
  });

  // password/method 단계가 아니면 영상 숨김
  if (activeKey !== "password" && activeKey !== "method") {
    hideDoorVideoInline();
    hideLockerVideoInline();
    hideCheckInVideoInline();
  }

  // UI 갱신 시 유휴 타이머 초기화 (6초 뒤 애니메이션 시작)
  resetConfirmIdleTimer(tableEl);
}

function finishConfirmSteps(tableEl) {
  // ★ 모든 단계 완료 시 안내 음성 정지
  stopGuideAudio();
  hideDoorVideoInline();
  hideLockerVideoInline();
  hideCheckInVideoInline();

  const rows = Array.from(tableEl.querySelectorAll("tr.confirm-row"));
  rows.forEach((row) => {
    row.classList.remove("is-blurred");
    row.classList.add("is-active");
    const btn = row.querySelector(".confirm-btn");
    if (btn) btn.style.display = "none";
  });

  window.location.href = `/index.html?lang=${getLanguageFromURL()}`;
}

// ==============================================
// 8. 예약 확인 및 UI 업데이트
// ==============================================
function buildRouteInstruction(roomNumber) {
  const baseRoom = roomNumber.includes("-")
    ? roomNumber.split("-")[0]
    : roomNumber;

  if (CONFIG.BACK_STAIR_ROOMS.has(baseRoom)) {
    return t(i18n.checkIn.routeBackStair, { room: baseRoom });
  }

  if (CONFIG.FRONT_PASS_ROOMS.has(baseRoom)) {
    return t(i18n.checkIn.routeFrontPass, { room: baseRoom });
  }

  return "";
}

function buildCheckInInstruction(roomNumber) {
  const isDorm = roomNumber.includes("-");

  const slipperText = isDorm
    ? t(i18n.checkIn.slipperBed, { room: roomNumber })
    : t(i18n.checkIn.slipperRoom, { room: roomNumber });

  const routeText = buildRouteInstruction(roomNumber);
  const amenityText = i18n.checkIn.amenity;

  return `
    ${slipperText}<br>
    ${amenityText}<br>
    ${routeText}
  `;
}

function checkReservation() {
  const rawInput = document.getElementById("reservationInput").value.trim();
  const input = rawInput.toUpperCase();
  const errorMessage = document.getElementById("errorMessage");
  const detailsDiv = document.getElementById("details");

  hideDoorVideoInline();
  hideLockerVideoInline();
  hideCheckInVideoInline();
  lastHasRoomPassword = false;
  lastHasLockerPassword = false;
  lastHasCheckInInstructionVideo = false;

  // 데이터 로드 실패 상태라면 재시도 안내
  if (!excelLoadSuccess) {
    errorMessage.style.display = "block";
    errorMessage.textContent = i18n?.loadError ||
      "Reservation data is not loaded. Please wait and try again.";
    detailsDiv.innerHTML = "";
    return;
  }

  if (!input) {
    errorMessage.style.display = "block";
    errorMessage.textContent = i18n.enterReservation;
    detailsDiv.innerHTML = "";
    toggleNavigationButtons(true);
    return;
  }

  const findByName = (q) => {
    const matches = Array.from(reservationData.values()).filter((d) => matchesName(q, d.name));
    if (matches.length >= 2) return { status: "multi" };
    if (matches.length === 1) return { status: "one", item: matches[0] };
    return { status: "none" };
  };

  let matchingReservation = null;

  if (reservationData.has(input)) {
    matchingReservation = reservationData.get(input);
  } else {
    const looksLikeReservationNumber = /\d/.test(rawInput);
    const byName = findByName(rawInput);

    if (looksLikeReservationNumber) {
      if (byName.status === "one") {
        matchingReservation = byName.item;
      } else if (byName.status === "multi") {
        errorMessage.style.display = "block";
        errorMessage.textContent = i18n.duplicateName;
        detailsDiv.innerHTML = "";
        toggleNavigationButtons(true);
        return;
      } else {
        reservationSearchFailCount += 1;
        if (reservationSearchFailCount >= 3) {
          showSearchFailHelp();
          errorMessage.style.display = "none";
        } else {
          errorMessage.style.display = "block";
          errorMessage.textContent = i18n.reservationNotFound;
        }
        detailsDiv.innerHTML = "";
        toggleNavigationButtons(true);
        return;
      }
    } else {
      if (byName.status === "one") {
        matchingReservation = byName.item;
      } else if (byName.status === "multi") {
        errorMessage.style.display = "block";
        errorMessage.textContent = i18n.duplicateName;
        detailsDiv.innerHTML = "";
        toggleNavigationButtons(true);
        return;
      } else {
        reservationSearchFailCount += 1;
        if (reservationSearchFailCount >= 3) {
          showSearchFailHelp();
          errorMessage.style.display = "none";
        } else {
          errorMessage.style.display = "block";
          errorMessage.textContent = i18n.reservationNotFound;
        }
        detailsDiv.innerHTML = "";
        toggleNavigationButtons(true);
        return;
      }
    }
  }

  // 매칭 성공 시 버튼 숨김
  toggleNavigationButtons(false);

  errorMessage.style.display = "none";
  reservationSearchFailCount = 0;
  hideSearchFailHelp();

  const roomNumber = matchingReservation.room_number;
  // 방 번호에 하이픈(-)이 포함되어 있으면 도미토리(침대번호 있음)로 판단합니다.
  const isDorm = roomNumber.includes("-");

  // 중국어 언어 + 개인실(하이픈 없음)인 경우 금연 동의 단계를 먼저 보여줍니다.
  const lang = getLanguageFromURL();
  if (lang === "zh" && !isDorm) {
    showSmokingAgreement(matchingReservation, roomNumber, isDorm);
    return;
  }

  // 그 외의 경우 바로 예약 정보 표시
  renderReservationDetails(matchingReservation, roomNumber, isDorm);
}

/**
 * 금연 동의 배너를 표시합니다.
 */
function showSmokingAgreement(reservation, roomNumber, isDorm) {
  const detailsDiv = document.getElementById("details");
  if (!detailsDiv) return;

  detailsDiv.innerHTML = `
    <div class="agreement-banner">
      <div class="agreement-msg">${i18n.smokingWarning}</div>
      <button type="button" class="agreement-btn" id="agreeSmokingBtn">
        ${i18n.agreeButton}
      </button>
    </div>
  `;

  document.getElementById("agreeSmokingBtn").addEventListener("click", () => {
    renderReservationDetails(reservation, roomNumber, isDorm);
  });
}

/**
 * 실제 예약 정보를 화면에 렌더링하고 확인 단계를 시작합니다.
 */
function renderReservationDetails(matchingReservation, roomNumber, isDorm) {
  const detailsDiv = document.getElementById("details");
  if (!detailsDiv) return;

  const roomPassword = roomPasswords[roomNumber] || "";
  const lockerPassword = lockerPasswords[roomNumber] || "";

  const hasRoomPassword = !!roomPassword;
  const hasLockerPassword = !!lockerPassword;

  lastHasRoomPassword = hasRoomPassword;
  lastHasLockerPassword = hasLockerPassword;

  // 체크인 방법 영상은 항상 있다고 가정
  lastHasCheckInInstructionVideo = true;

  let passwordTitle = "";
  let passwordDisplay = "";

  if (hasRoomPassword && hasLockerPassword) {
    passwordTitle = i18n.tableHeaders.roomAndLockerPassword;
    const rLabel = i18n.tableHeaders.roomLabel || "Room";
    const lLabel = i18n.tableHeaders.lockerLabel || "Locker";
    passwordDisplay = `${rLabel}:${roomPassword} ${lLabel}: ${lockerPassword}`;
  } else if (hasRoomPassword) {
    passwordTitle = i18n.tableHeaders.roomPassword;
    passwordDisplay = roomPassword;
  } else if (hasLockerPassword) {
    passwordTitle = i18n.tableHeaders.lockerPassword;
    passwordDisplay = lockerPassword;
  }

  let roomDisplay = roomNumber;
  if (isDorm) {
    const roomParts = roomNumber.split("-");
    roomDisplay = `${roomParts[0]} (${i18n.bedNumber} ${roomParts[1]})`;
  }

  const rowsHtml = [];
  rowsHtml.push(buildConfirmRow(i18n.tableHeaders.name, matchingReservation.name, "name"));
  // 방번호 확인 행 추가 (도미토리 여부에 따라 버튼 문구가 달라짐)
  rowsHtml.push(buildConfirmRow(i18n.tableHeaders.roomNumber, roomDisplay, "room", isDorm));

  if (hasRoomPassword || hasLockerPassword) {
    rowsHtml.push(buildConfirmRow(passwordTitle, passwordDisplay, "password"));
  }

  rowsHtml.push(buildConfirmRow(i18n.tableHeaders.checkoutDate, matchingReservation.check_out_date, "checkout"));

  const checkInText = buildCheckInInstruction(roomNumber);
  rowsHtml.push(buildConfirmRow(i18n.tableHeaders.checkInMethod, checkInText, "method"));

  detailsDiv.innerHTML = `
  <div id="doorInlineWrap" class="video-inline-wrap">
    <div class="video-inline-box video-with-close">
      <button class="video-close-btn" data-prefix="doorInline">✕</button>

      <video id="doorInlineVideo"
             class="video-inline-player"
             playsinline
             muted
             preload="metadata">
        <source src="../videos/Door_Open.mp4" type="video/mp4" />
      </video>

      <div class="video-progress-wrap">
        <div id="doorProgress" class="video-progress-bar"></div>
      </div>
    </div>
  </div>

  <div id="lockerInlineWrap" class="video-inline-wrap">
    <div class="video-inline-box video-with-close">
      <button class="video-close-btn" data-prefix="lockerInline">✕</button>

      <video id="lockerInlineVideo"
             class="video-inline-player"
             playsinline
             muted
             preload="metadata">
        <source src="../videos/Locker_Open.mp4" type="video/mp4" />
        이 브라우저에서는 동영상을 재생할 수 없습니다.
      </video>

      <div class="video-progress-wrap">
        <div id="lockerProgress" class="video-progress-bar"></div>
      </div>
    </div>
  </div>

  <div id="checkinInlineWrap" class="video-inline-wrap">
    <div class="video-inline-box video-with-close">
      <button class="video-close-btn" data-prefix="checkinInline">✕</button>

      <video id="checkinInlineVideo"
             class="video-inline-player"
             playsinline
             muted
             preload="metadata">
        <source src="../videos/Check_In_Instruction.mp4" type="video/mp4" />
        이 브라우저에서는 동영상을 재생할 수 없습니다.
      </video>

      <div class="video-progress-wrap">
        <div id="checkinProgress" class="video-progress-bar"></div>
      </div>
    </div>
  </div>

  <table class="details-table confirm-table">
    ${rowsHtml.join("")}
  </table>
`;


  applyConfirmStepUI(detailsDiv.querySelector("table.confirm-table"));

  // ★ 이름이 테이블에 표시된 직후 → 이름 확인 안내 음성 재생
  playGuideAudio("name");
}

/**
 * 하단 네비게이션 버튼(Home, Help) 표시 여부를 제어합니다.
 * @param {boolean} show true면 표시, false면 숨김
 */
function toggleNavigationButtons(show) {
  const container = document.getElementById("common-buttons");
  if (container) {
    container.style.display = show ? "flex" : "none";
  }
}

// ==============================================
// 9. DOMContentLoaded 초기화
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  await loadLanguageData();
  updateUITexts();
  await Promise.all([loadExcelData(), loadPasswordData()]);

  document.getElementById("searchButton").addEventListener("click", checkReservation);
  document.getElementById("reservationInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkReservation();
  });

  // F1 (도움말), F3 (찾기) 키 비활성화
  window.addEventListener("keydown", (e) => {
    if (e.key === "F1" || e.key === "F3") {
      e.preventDefault();
      console.log(`[System] ${e.key} key disabled to prevent accidental navigation.`);
    }
  });

  createCommonButtons();
  toggleNavigationButtons(true);
});

// ==============================================
// X 버튼 클릭 시 영상 즉시 닫기
// ==============================================
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".video-close-btn");
  if (!btn) return;

  const prefix = btn.getAttribute("data-prefix");
  const exitType = btn.getAttribute("data-exit");

  // 1. 영상 닫기
  _hideInlineVideo(prefix);

  // 2. 분기 처리
  if (exitType === "home") {
    // 처음 화면으로
    window.location.href = `/index.html?lang=${getLanguageFromURL()}`;
    return;
  }

  // 3. 기본 동작: 다음 단계로 이동
  if (
    typeof skipVideoAndGoToNextStep === "function" &&
    Array.isArray(confirmStepOrder) &&
    confirmStepOrder.length > 0
  ) {
    skipVideoAndGoToNextStep();
  }

});


/**
 * 가상 키보드 (OSK: On-Screen Keyboard) 시스템
 * 예약번호(숫자)와 이름(영문) 입력을 지원합니다.
 */
(function () {
  let activeInput = null;
  let mode = "num"; // "num" (숫자) 또는 "abc" (영문)

  const osk = document.getElementById("osk");
  const oskKeys = document.getElementById("oskKeys");
  const oskTitle = osk?.querySelector(".osk-title");

  if (!osk || !oskKeys) return;

  // OSK에 표시될 텍스트
  const OSK_TEXT = {
    title: "Virtual Keyboard",
    done: "Done",
    clear: "Clear"
  };

  let currentLang = "en"; // "en" (영문) 또는 "ko" (국문)

  // 상단바에 들어갈 영문 키보드 배열
  const layoutEn = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"]
  ];

  // 한글(자음/모음) 키보드 레이아웃
  const layoutKo = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
    ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"],
    ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"]
  ];

  /**
   * 키보드 렌더링 함수
   */
  function renderKeys() {
    oskKeys.innerHTML = "";

    const activeLayout = currentLang === "ko" ? layoutKo : layoutEn;

    activeLayout.forEach(row => {
      const rowEl = document.createElement("div");
      rowEl.className = "osk-row";
      row.forEach(key => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "osk-key";
        btn.textContent = key;
        btn.dataset.key = key;
        rowEl.appendChild(btn);
      });
      oskKeys.appendChild(rowEl);
    });

    // 마지막 줄: 한/영 토글 버튼, Space와 Done 버튼 배치
    const bottomRow = document.createElement("div");
    bottomRow.className = "osk-row";

    const langToggleBtn = document.createElement("button");
    langToggleBtn.type = "button";
    langToggleBtn.className = "osk-key wide";
    langToggleBtn.textContent = currentLang === "en" ? "한글" : "ENG";
    langToggleBtn.dataset.action = "toggleLang";
    bottomRow.appendChild(langToggleBtn);

    const spaceBtn = document.createElement("button");
    spaceBtn.type = "button";
    spaceBtn.className = "osk-key wider";
    spaceBtn.textContent = "Space";
    spaceBtn.dataset.key = " ";
    bottomRow.appendChild(spaceBtn);

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "osk-key wide osk-btn-primary";
    doneBtn.textContent = OSK_TEXT.done;
    doneBtn.dataset.action = "done";
    bottomRow.appendChild(doneBtn);

    oskKeys.appendChild(bottomRow);

    if (oskTitle) oskTitle.textContent = OSK_TEXT.title;
  }

  /**
   * 키보드 열기
   */
  function openOSK(inputEl) {
    activeInput = inputEl;
    osk.classList.remove("hidden");
    osk.setAttribute("aria-hidden", "false");

    // 입력창으로 스크롤 이동 (키보드가 나타날 때 입력창이 보이도록)
    setTimeout(() => {
      inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  /**
   * 키보드 닫기
   */
  function closeOSK() {
    osk.classList.add("hidden");
    osk.setAttribute("aria-hidden", "true");
    activeInput = null;
  }

  /**
   * 텍스트 삽입 (커서 위치 고려)
   */
  function insertText(text) {
    if (!activeInput) return;
    const el = activeInput;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const val = el.value;
    const beforeCursor = val.slice(0, start);
    const afterCursor = val.slice(end);

    const isKoreanJamo = /[ㄱ-ㅎㅏ-ㅣ]/.test(text);
    const lastChar = beforeCursor.slice(-1);
    const isLastCharKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(lastChar);

    if (currentLang === "ko" && isKoreanJamo && isLastCharKorean && typeof Hangul !== "undefined") {
      // Hangul.js를 이용한 글자 조합
      const disassembled = Hangul.d(lastChar);
      disassembled.push(text);
      const assembled = Hangul.a(disassembled);
      
      el.value = beforeCursor.slice(0, -1) + assembled + afterCursor;
      const newPos = start - 1 + assembled.length;
      el.setSelectionRange(newPos, newPos);
    } else {
      el.value = beforeCursor + text + afterCursor;
      const newPos = start + text.length;
      el.setSelectionRange(newPos, newPos);
    }

    el.focus();

    // input 이벤트 발생 (다른 리스너들이 변경 감지하도록 함)
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * 백스페이스 처리
   */
  function handleBackspace() {
    if (!activeInput) return;
    const el = activeInput;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const val = el.value;
    if (start !== end) {
      el.value = val.slice(0, start) + val.slice(end);
      el.setSelectionRange(start, start);
    } else if (start > 0) {
      el.value = val.slice(0, start - 1) + val.slice(start);
      el.setSelectionRange(start - 1, start - 1);
    }
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * 전체 삭제
   */
  function clearInput() {
    if (!activeInput) return;
    activeInput.value = "";
    activeInput.focus();
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // 대상 입력창 이벤트 연결
  const reservationInput = document.getElementById("reservationInput");
  if (reservationInput) {
    reservationInput.addEventListener("focus", () => openOSK(reservationInput));
    reservationInput.addEventListener("click", () => openOSK(reservationInput));
    // 터치 기기 대응
    reservationInput.addEventListener("touchstart", (e) => {
      openOSK(reservationInput);
    }, { passive: true });
  }

  // 키보드 버튼 클릭 이벤트 리스너 (위임 방식)
  osk.addEventListener("click", (e) => {
    // 버튼 클릭 시 포커스 빼앗기지 않도록 함
    e.preventDefault();

    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const key = btn.dataset.key;

    if (action === "bksp" || btn.getAttribute("data-action") === "bksp") {
      handleBackspace();
      return;
    }

    if (action === "clear") {
      clearInput();
      return;
    }

    if (action === "done") {
      closeOSK();
      return;
    }

    if (action === "toggleLang") {
      currentLang = currentLang === "en" ? "ko" : "en";
      renderKeys();
      return;
    }

    if (key !== undefined) {
      insertText(key);
    }
  });

  // 외부 클릭 시 키보드 닫기
  document.addEventListener("mousedown", (e) => {
    if (osk.classList.contains("hidden")) return;

    const withinOSK = osk.contains(e.target);
    const withinInput = activeInput && activeInput.contains(e.target);

    if (!withinOSK && !withinInput) {
      closeOSK();
    }
  });

  // 초기 렌더링
  renderKeys();
})();

