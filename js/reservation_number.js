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

  if (currentKey === "password") {
    // password 단계 영상 스킵 시 checkout 단계로
    const checkoutIndex = confirmStepOrder.indexOf("checkout");
    if (checkoutIndex !== -1) {
      currentConfirmStep = checkoutIndex;
      updateConfirmStepUI(document.querySelector("table.confirm-table"));
    }
  } else if (currentKey === "method") {
    // method 단계 영상 스킵 시 바로 버튼 활성화
    const methodBtn = document.querySelector('table.confirm-table .confirm-row[data-stepkey="method"] .confirm-btn');
    if (methodBtn) methodBtn.disabled = false;
  }
}


// ==============================================
// 7. 단계별 확인(Blur + 확인 버튼)
// ==============================================

let confirmStepOrder = [];
let currentConfirmStep = 0;

function getConfirmButtonText(stepKey) {
  const lang = document.documentElement.lang || "ko";

  const dict = {
    ko: {
      name: "이름 확인",
      room: "방(침대번호) 확인",
      password: "비밀번호 확인",
      checkout: "퇴실 날짜 확인",
      method: "체크인 방법 확인",
      done: "확인 완료"
    },
    en: {
      name: "Check Name",
      room: "Check Room / Bed Number",
      password: "Check Password",
      checkout: "Check Check-out Date",
      method: "Check Check-in Instructions",
      done: "Done"
    },
    ja: {
      name: "名前の確認",
      room: "部屋・ベッド番号の確認",
      password: "パスワードの確認",
      checkout: "チェックアウト日の確認",
      method: "チェックイン方法の確認",
      done: "確認完了"
    },
    zh: {
      name: "确认姓名",
      room: "确认房间 / 床位号",
      password: "确认密码",
      checkout: "确认退房日期",
      method: "确认入住方式",
      done: "确认完成"
    }
  };

  const table = dict[lang] || dict.en;
  return table[stepKey] || table.done;
}

function buildConfirmRow(thText, valueHtml, stepKey) {
  const btnText = getConfirmButtonText(stepKey);
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

    // method 단계 진입 시 자동 영상 재생
    const newStepKey = confirmStepOrder[currentConfirmStep];
    if (newStepKey === "method" && lastHasCheckInInstructionVideo) {
      const btn = tableEl.querySelector('.confirm-row[data-stepkey="method"] .confirm-btn');
      if (btn) btn.disabled = true;
      showCheckInVideoInline(() => {
        if (btn) btn.disabled = false;
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
}

function finishConfirmSteps(tableEl) {
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
        return;
      }
    } else {
      if (byName.status === "one") {
        matchingReservation = byName.item;
      } else if (byName.status === "multi") {
        errorMessage.style.display = "block";
        errorMessage.textContent = i18n.duplicateName;
        detailsDiv.innerHTML = "";
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
        return;
      }
    }
  }

  errorMessage.style.display = "none";
  reservationSearchFailCount = 0;
  hideSearchFailHelp();

  const roomNumber = matchingReservation.room_number;
  const roomPassword = roomPasswords[roomNumber] || "";
  const lockerPassword = lockerPasswords[roomNumber] || "";

  const hasRoomPassword = !!roomPassword;
  const hasLockerPassword = !!lockerPassword;

  lastHasRoomPassword = hasRoomPassword;
  lastHasLockerPassword = hasLockerPassword;

  // 체크인 방법 영상은 항상 있다고 가정(원하시면 조건 분기 가능)
  lastHasCheckInInstructionVideo = true;

  let passwordTitle = "";
  let passwordDisplay = "";

  if (hasRoomPassword && hasLockerPassword) {
    passwordTitle = i18n.tableHeaders.roomAndLockerPassword;
    passwordDisplay = `${roomPassword} / ${lockerPassword}`;
  } else if (hasRoomPassword) {
    passwordTitle = i18n.tableHeaders.roomPassword;
    passwordDisplay = roomPassword;
  } else if (hasLockerPassword) {
    passwordTitle = i18n.tableHeaders.lockerPassword;
    passwordDisplay = lockerPassword;
  }

  let roomDisplay = roomNumber;
  const roomParts = roomNumber.split("-");
  if (roomParts.length === 2) {
    roomDisplay = `${roomParts[0]} (${i18n.bedNumber} ${roomParts[1]})`;
  }

  const rowsHtml = [];
  rowsHtml.push(buildConfirmRow(i18n.tableHeaders.name, matchingReservation.name, "name"));
  rowsHtml.push(buildConfirmRow(i18n.tableHeaders.roomNumber, roomDisplay, "room"));

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

  createCommonButtons();
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


(function () {
  let activeInput = null;
  let mode = "num";

  const osk = document.getElementById("osk");
  const oskKeys = document.getElementById("oskKeys");
  const oskModeBtn = document.getElementById("oskModeBtn");
  if (!osk || !oskKeys || !oskModeBtn) return;

  const targets = [
    document.getElementById("reservationInput"),
  ].filter(Boolean);

  const layoutNum = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["-", "/", "*", "+", "(", ")", ".", ",", "@", "#"]
  ];

  const layoutText = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", "-"],
    ["z", "x", "c", "v", "b", "n", "m", ".", "@", "_"]
  ];

  function renderKeys() {
    oskKeys.innerHTML = "";
    const layout = (mode === "num") ? layoutNum : layoutText;

    layout.forEach(row => {
      const rowEl = document.createElement("div");
      rowEl.className = "osk-row";
      row.forEach(k => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "osk-key";
        btn.textContent = k;
        btn.dataset.key = k;
        rowEl.appendChild(btn);
      });
      oskKeys.appendChild(rowEl);
    });

    const last = document.createElement("div");
    last.className = "osk-row";
    last.style.gridTemplateColumns = "repeat(10, 1fr)";

    const space = document.createElement("button");
    space.type = "button";
    space.className = "osk-key wider";
    space.textContent = "Space";
    space.dataset.key = " ";
    last.appendChild(space);

    const enter = document.createElement("button");
    enter.type = "button";
    enter.className = "osk-key wide";
    enter.textContent = "Enter";
    enter.dataset.action = "done";
    last.appendChild(enter);

    oskKeys.appendChild(last);

    oskModeBtn.textContent = (mode === "num") ? "ABC" : "123";
  }

  function openOSK(inputEl) {
    activeInput = inputEl;
    osk.classList.remove("hidden");
    osk.setAttribute("aria-hidden", "false");
    document.body.classList.add("body-has-osk");

    try {
      const v = inputEl.value || "";
      inputEl.focus();
      inputEl.setSelectionRange(v.length, v.length);
    } catch (e) { }
  }

  function closeOSK() {
    osk.classList.add("hidden");
    osk.setAttribute("aria-hidden", "true");
    document.body.classList.remove("body-has-osk");
    activeInput = null;
  }

  function insertText(text) {
    if (!activeInput) return;
    const el = activeInput;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + text + after;

    const newPos = start + text.length;
    try {
      el.focus();
      el.setSelectionRange(newPos, newPos);
    } catch (e) { }

    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function backspace() {
    if (!activeInput) return;
    const el = activeInput;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    if (start !== end) {
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      el.value = before + after;
      try { el.setSelectionRange(start, start); } catch (e) { }
    } else if (start > 0) {
      const before = el.value.slice(0, start - 1);
      const after = el.value.slice(start);
      el.value = before + after;
      try { el.setSelectionRange(start - 1, start - 1); } catch (e) { }
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    try { el.focus(); } catch (e) { }
  }

  function clearAll() {
    if (!activeInput) return;
    activeInput.value = "";
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    try { activeInput.focus(); } catch (e) { }
  }

  targets.forEach(el => {
    el.addEventListener("focus", () => openOSK(el));
    el.addEventListener("click", () => openOSK(el));
    el.addEventListener("touchstart", () => openOSK(el), { passive: true });
  });

  osk.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const action = t.dataset.action;
    const key = t.dataset.key;

    if (action === "mode") {
      mode = (mode === "num") ? "text" : "num";
      renderKeys();
      return;
    }
    if (action === "bksp") return backspace();
    if (action === "clear") return clearAll();
    if (action === "done") return closeOSK();

    if (typeof key === "string") insertText(key);
  });

  renderKeys();

  document.addEventListener("mousedown", (e) => {
    if (!osk.classList.contains("hidden")) {
      const withinOSK = osk.contains(e.target);
      const withinInput = activeInput && activeInput.contains(e.target);
      if (!withinOSK && !withinInput) closeOSK();
    }
  });
})();

