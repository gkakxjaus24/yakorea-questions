/* ============================================================
   늦은 체크아웃 신청/취소

   ⚠️ 이 파일은 두 사이트에서 **같은 내용으로** 쓰인다.
     - 키오스크:  Project_Claude/js/late_checkout.js  (원본)
     - QR 사이트: yakorea-questions/js/late_checkout.js (복사본)
   한쪽만 고치면 "키오스크에선 되는데 QR에선 안 되는" 손님이 생긴다.
   어긋남은 Project_Claude/tests/late_checkout_sync.test.js가 감시한다.

   그래서 아래 두 가지를 지킨다:
     - 경로는 루트 기준("/data/...", "/images/...")으로 쓴다. 키오스크는
       프로젝트 루트를 127.0.0.1:8000으로 서빙하고, QR 사이트는 레포 루트가
       사이트 루트라 양쪽에서 같은 경로가 맞는다.
     - 한쪽에만 있는 함수(createCommonButtons, openOSK)는 있을 때만 부른다.
   ============================================================ */

let i18n;
let selectedReservation = null;

// 체크인 기록에 쓰는 것과 동일한 Apps Script 웹앱 — config.js의 CHECKIN_SCRIPT_URL에서
// 관리 (check_out_room.js / reservation_number.js와 공유).
const GOOGLE_APP_SCRIPT_URL = CONFIG.CHECKIN_SCRIPT_URL;

// 날짜 표시용 locale 매핑 — 16개 언어를 손으로 포맷하는 대신 Intl에 맡긴다.
//
// ⚠️ `-u-ca-gregory-nu-latn`을 반드시 붙인다.
//   ca-gregory: ar-SA는 기본 달력이 이슬람력이라 그냥 두면 "١٤ ربيع الأول"처럼
//     히즈라 날짜가 나온다. 손님 예약의 체크아웃 날짜는 그레고리력이므로 손님이
//     전혀 다른 날로 읽는다(2026-08-26 브라우저 확인, 실제로 그렇게 나왔음).
//     hi-IN·th-TH도 환경에 따라 다른 달력/연호를 쓸 수 있어 전 언어에 통일해 붙였다.
//   nu-latn: 아랍어·힌디어는 기본 숫자가 ١٤ / १४ 라서, 옆에 함께 보이는 방 번호
//     (209 같은 라틴 숫자)와 표기가 어긋난다.
const LOCALE_MAP = {
  ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', ru: 'ru-RU', es: 'es-ES',
  mn: 'mn-MN', vi: 'vi-VN', fr: 'fr-FR', de: 'de-DE', ar: 'ar', tr: 'tr-TR',
  hi: 'hi-IN', si: 'si-LK', th: 'th-TH', id: 'id-ID',
};

function localeForDates() {
  const base = LOCALE_MAP[getLanguageFromURL()] || 'en-US';
  return base + '-u-ca-gregory-nu-latn';
}

async function loadLanguageData() {
  i18n = await loadI18n("/data/late_checkout.json");
  return !!i18n;
}

// "dd/MM/yyyy" → Date (로컬 자정). 예약 데이터의 날짜 형식이 전부 이것이다.
// ⚠️ 날짜 "판정"(오늘/내일인지, 11시를 넘겼는지)은 전부 서버가 한다 — 여기서는
// 화면에 예쁘게 보여주기 위한 파싱만 한다. 손님 휴대폰 시계는 믿을 수 없다.
function parseDDMMYYYY(str) {
  const m = String(str || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function formatDateForDisplay(dateText) {
  const d = parseDDMMYYYY(dateText);
  if (!d) return dateText;
  try {
    return new Intl.DateTimeFormat(localeForDates(), {
      month: 'long', day: 'numeric', weekday: 'short',
      calendar: 'gregory', numberingSystem: 'latn',
    }).format(d);
  } catch (e) {
    // Intl이 로케일을 못 다루면 원본(dd/MM/yyyy)을 그대로 보여준다 — 날짜를
    // 아예 못 보여주는 것보다 낫다.
    return dateText;
  }
}

function callLateCheckoutApi(action, resNum) {
  return fetch(GOOGLE_APP_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, resNum }),
  }).then((res) => res.json());
}

// 이름(또는 예약번호 뒷자리)으로 예약 한 건을 조회한다.
// 이름은 이 요청에만 쓰이고 응답에는 되돌아오지 않는다 — 서버는 방번호와
// 체크아웃 날짜만 돌려준다.
function lookupReservation(name) {
  return fetch(GOOGLE_APP_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "late_checkout_lookup", name }),
  }).then((res) => res.json());
}

function showMessage(stage, main, sub) {
  // 이름 입력 화면을 벗어났으므로 가상 키보드의 "Done" 훅을 해제한다
  // (사라진 입력창을 가리키는 콜백이 남지 않도록).
  window.oskOnDone = null;
  if (typeof window.closeOSK === "function") window.closeOSK();

  stage.innerHTML = `
    <div class="co-confirm">${main}</div>
    ${sub ? `<div class="co-confirm-sub">${sub}</div>` : ''}
  `;
  // 키오스크는 다음 손님을 위해 첫 화면으로 되돌아가야 한다. 손님 휴대폰(QR)에서는
  // 보고 있는 페이지가 갑자기 넘어가면 당황스러우므로 그대로 둔다.
  if (document.body.dataset.kiosk !== undefined) {
    setTimeout(() => {
      window.location.href = "/index.html";
    }, 30000);
  }
}

// ── 1단계: 이름(또는 예약번호) 입력 ────────────────────────────────────────
function renderNameStep(stage, prefillMessage) {
  const headline = document.querySelector(".headline");
  if (headline) headline.innerHTML = i18n.title;

  stage.innerHTML = `
    ${prefillMessage ? `<div class="lc-inline-error">${prefillMessage}</div>` : ''}
    <div class="lc-subtitle">${i18n.nameStepTitle}</div>
    <div class="lc-search-row">
      <input type="text" id="lcNameInput" class="lc-name-input" autocomplete="off" />
      <button class="lc-search-btn" id="lcSearchBtn" data-osk-keep>${i18n.searchButton}</button>
    </div>
  `;

  const input = document.getElementById("lcNameInput");
  const submit = () => {
    if (typeof window.closeOSK === "function") window.closeOSK();
    handleNameSubmit(stage, input.value);
  };

  document.getElementById("lcSearchBtn").addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  // 가상 키보드(js/osk.js) 연결.
  // ⚠️ osk.js의 자동 연결([data-osk])은 스크립트가 읽히는 시점(DOMContentLoaded 이전)에
  // 한 번만 돌기 때문에, 이렇게 나중에 만들어지는 입력창은 잡지 못한다.
  // 그래서 window.openOSK로 직접 연결한다.
  if (typeof window.openOSK === "function") {
    input.addEventListener("focus", () => window.openOSK(input));
    input.addEventListener("click", () => window.openOSK(input));
    input.addEventListener("touchstart", () => window.openOSK(input), { passive: true });
    // 키보드의 "Done" 키가 검색 버튼과 같은 동작을 하도록 등록
    window.oskOnDone = submit;
  }
  // ⚠️ 여기서 키보드를 자동으로 열지 않는다(예약조회 화면과 동일하게 "탭하면 열림").
  // 자동으로 열면 openOSK의 scrollIntoView가 화면을 밀어 올려 헤드라인 아래로
  // 본문이 파고든다 — 안내문+입력창+키보드를 합치면 세로 공간을 넘기기 때문
  // (2026-08-26 브라우저 프리뷰로 측정 확인: 콘텐츠 725px > 영역 620px).
}

// 이름(또는 예약번호 뒷자리)을 서버에 보내 예약 한 건을 받아온다.
//
// ⚠️ 조회를 서버에서 하는 이유(2026-08-26): 손님 휴대폰(QR)에서도 신청할 수 있게
// 하려면, 예약 목록 전체를 브라우저로 내려받아 거기서 찾는 방식을 쓸 수 없다.
// 그러면 전 투숙객의 이름·방번호·체크아웃 날짜가 손님 휴대폰으로 통째로
// 다운로드된다. 서버가 매칭해서 **그 손님 한 건만** 돌려준다.
// 이름 매칭 규칙 자체는 예약조회 화면과 동일하다(google_apps_script/name_match.gs
// 는 js/name_match.js의 복사본, tests/name_match_sync.test.js가 어긋남을 감시).
//
// 조회·날짜 규칙 판정·기존 신청 여부를 서버가 한 번에 돌려주므로 왕복은 1회다.
function handleNameSubmit(stage, query) {
  const q = String(query || "").trim();
  if (!q) return;

  // 이름 입력 화면은 여기서 끝 — 키보드와 훅을 정리한다.
  window.oskOnDone = null;
  if (typeof window.closeOSK === "function") window.closeOSK();

  stage.innerHTML = `<div class="co-confirm-question">${i18n.checkingMessage}</div>`;

  // ⚠️ dev 모드에서도 조회는 그대로 한다. dev 모드의 목적은 "시트에 쓰지 않기"이지
  // "읽지 않기"가 아니다. 조회는 아무것도 오염시키지 않고, 여기서 막아버리면
  // 노트북에서 이 화면을 전혀 테스트할 수 없게 된다(실제 기록은 submitLateCheckout이 막는다).
  lookupReservation(q)
    .then((data) => {
      if (!data || data.status !== "ok") {
        showMessage(stage, i18n.errorMessage);
        return;
      }
      if (data.found === "multi") {
        renderNameStep(stage, i18n.multiMatchMessage);
        return;
      }
      if (data.found !== "one") {
        renderNameStep(stage, i18n.notFoundMessage);
        return;
      }

      selectedReservation = {
        resNum: data.resNum,
        room: data.room,
        checkOut: data.checkOut,
      };

      // 이미 신청돼 있으면 날짜 규칙과 무관하게 취소 흐름 — 신청 후 예약이
      // 바뀌었다고 취소를 막으면 손님이 갇힌다(서버도 같은 순서로 판단).
      if (data.applied) {
        renderCancelConfirm(stage);
        return;
      }

      const dateDisplay = formatDateForDisplay(data.checkOut);
      if (data.allow === "past") {
        showMessage(stage, t(i18n.alreadyPastMessage, { date: dateDisplay }));
        return;
      }
      if (data.allow === "too_early") {
        showMessage(stage, t(i18n.tooEarlyMessage, { date: dateDisplay }));
        return;
      }
      if (data.allow === "cutoff") {
        showMessage(stage, i18n.cutoffMessage);
        return;
      }
      if (data.allow !== "ok") {
        showMessage(stage, i18n.errorMessage);
        return;
      }

      renderPledge(stage);
    })
    .catch((err) => {
      console.error("[늦은체크아웃] 예약 조회 실패:", err);
      showMessage(stage, i18n.errorMessage);
    });
}

// ── 방 유형 판정 ──────────────────────────────────────────────────────────
//
// ⚠️ 이 규칙은 Apps Script의 classifyRoomType_()과 **같아야 한다**
// (checkin_confirm.gs, 2026-08-19 통계용으로 먼저 만들어진 것). 규칙 자체는
// "유닛에 하이픈이 있으면 도미토리" 한 줄이다 — 도미토리는 예약이 침대 단위라
// "301-3"(301호 3번 침대)처럼 오고, 개인실은 "209"처럼 방 하나로 온다.
// 그룹 예약은 콤마로 여러 유닛이 온다: "301-3, 301-4".
//
// 여기서 다시 판정하는 이유: 서버가 방 유형을 안 돌려주기 때문이 아니라,
// 어차피 방번호는 화면에 이미 있어서 왕복을 늘릴 이유가 없기 때문이다.
// 규칙이 갈라지면 "사진만 틀린" 조용한 버그가 되므로, 고칠 일이 생기면
// 반드시 .gs 쪽도 같이 고칠 것.
function classifyRoomType(roomStr) {
  const units = String(roomStr || "").split(",").map((u) => u.trim()).filter(Boolean);
  if (units.length === 0) return "";
  const dormCount = units.filter((u) => u.includes("-")).length;
  if (dormCount === 0) return "private";
  if (dormCount === units.length) return "dorm";
  return "mixed";
}

// 방 유형별 정리 안내(사진 + 번호 목록).
//
// 개인실과 도미토리는 정리 방법이 다르다 — 개인실은 화장실 쓰레기 분리배출이,
// 도미토리는 사물함 비우기가 핵심이다. 그룹 예약이 두 유형에 걸쳐 있으면
// (예: "209, 301-3") 둘 다 보여준다. 하나만 골라 보여주면 나머지 방 손님은
// 자기와 무관한 안내를 받게 된다.
const TIDY_SECTIONS = {
  private: {
    image: "/images/faq/late_checkout_private.jpg",
    steps: "tidyPrivate",
    label: "roomTypePrivate",
  },
  dorm: {
    image: "/images/faq/late_checkout_dorm.jpg",
    steps: "tidyDorm",
    label: "roomTypeDorm",
  },
};

// withLabel: 혼합 예약일 때만 "개인실"/"도미토리" 딱지를 붙인다. 한 유형뿐이면
// 딱지가 없어야 화면이 간결하고, 어차피 자기 방 얘기라 헷갈릴 일이 없다.
function tidySection(type, withLabel) {
  const spec = TIDY_SECTIONS[type];
  // <ol>이 번호를 붙이므로 문구에는 "1." 같은 번호를 넣지 않는다
  const steps = (i18n[spec.steps] || []).map((text) => `<li>${text}</li>`).join("");
  return `
    <div class="lc-tidy-section">
      ${withLabel ? `<div class="lc-tidy-label">${i18n[spec.label]}</div>` : ''}
      <img class="lc-tidy-photo" src="${spec.image}" alt="" onerror="this.remove()" />
      <ol class="lc-tidy-steps">${steps}</ol>
    </div>
  `;
}

function tidyGuide(roomStr) {
  const type = classifyRoomType(roomStr);
  // 판정이 안 되면(방번호가 비었거나 형식이 낯설면) 안내를 통째로 생략한다.
  // 틀린 안내를 보여주는 것보다 낫고, 신청 자체는 그대로 진행된다.
  if (!type) return "";
  const mixed = type === "mixed";
  const types = mixed ? ["private", "dorm"] : [type];
  return `
    <div class="lc-tidy">
      <div class="lc-tidy-title">${i18n.tidyTitle}</div>
      ${types.map((tp) => tidySection(tp, mixed)).join("")}
    </div>
  `;
}

// 예약 정보(방번호·체크아웃 날짜)를 보여주는 카드 — 신청/취소 화면에서 공유.
function reservationCard() {
  const res = selectedReservation;
  return `
    <div class="lc-res-card">
      <div class="lc-res-row">
        <span class="lc-res-label">${i18n.roomLabel}</span>
        <span class="lc-res-value">${res.room}</span>
      </div>
      <div class="lc-res-row">
        <span class="lc-res-label">${i18n.checkoutDateLabel}</span>
        <span class="lc-res-value">${formatDateForDisplay(res.checkOut)}</span>
      </div>
    </div>
  `;
}

// ── 3단계(신청): 방번호·날짜 확인 + 약속 ──────────────────────────────────
// 손님이 방번호를 고르는 게 아니라 시스템이 예약에서 꺼내 보여주므로, 남의 방을
// 신청하는 것이 구조적으로 불가능하다(2026-08-26 개편).
function renderPledge(stage) {
  const headline = document.querySelector(".headline");
  if (headline) headline.innerHTML = i18n.title;

  stage.innerHTML = `
    ${reservationCard()}
    ${tidyGuide(selectedReservation.room)}
    <div class="lc-pledge">${i18n.pledgeText}</div>
    <div class="co-confirm-buttons">
      <button class="co-confirm-yes" id="lcPledgeYes">${i18n.pledgeConfirmButton}</button>
    </div>
  `;

  document.getElementById("lcPledgeYes").addEventListener("click", () => {
    submitLateCheckout(stage, "late_checkout", i18n.applySuccessMain, i18n.applySuccessSub);
  });
}

// ── 3단계(취소): 이미 신청된 손님 ─────────────────────────────────────────
function renderCancelConfirm(stage) {
  const headline = document.querySelector(".headline");
  if (headline) headline.innerHTML = i18n.title;

  stage.innerHTML = `
    ${reservationCard()}
    <div class="lc-pledge">${i18n.alreadyAppliedTitle}<br>${i18n.cancelPromptText}</div>
    <div class="co-confirm-buttons">
      <button class="co-confirm-no" id="lcCancelYes">${i18n.pledgeConfirmButton}</button>
      <button class="co-confirm-yes" id="lcCancelNo">${i18n.keepButton}</button>
    </div>
  `;

  document.getElementById("lcCancelYes").addEventListener("click", () => {
    submitLateCheckout(stage, "late_checkout_cancel", i18n.cancelSuccessMain, i18n.cancelSuccessSub);
  });
  document.getElementById("lcCancelNo").addEventListener("click", () => {
    window.location.href = "/index.html";
  });
}

function submitLateCheckout(stage, action, successMain, successSub) {
  const res = selectedReservation;

  if (window.IS_DEV_MODE) {
    console.log(`[늦은체크아웃] DEV 모드 — ${action} 생략:`,
      res.resNum, res.room, res.checkOut);
    showMessage(stage, successMain, successSub);
    return;
  }

  stage.innerHTML = `<div class="co-confirm-question">${i18n.checkingMessage}</div>`;

  // 예약번호만 보낸다 — 방번호와 체크아웃 날짜는 서버가 예약에서 직접 꺼내 쓰므로,
  // 키오스크가 뭘 보내든 남의 방으로 기록될 여지가 없다.
  callLateCheckoutApi(action, res.resNum)
    .then((data) => {
      if (data.status === "blocked") {
        showMessage(stage, i18n.cutoffMessage);
        return;
      }
      if (data.status === "too_early") {
        showMessage(stage, t(i18n.tooEarlyMessage, { date: formatDateForDisplay(res.checkOut) }));
        return;
      }
      if (data.status !== "ok") {
        showMessage(stage, i18n.errorMessage);
        return;
      }
      showMessage(stage, successMain, successSub);
    })
    .catch((err) => {
      console.error(`[늦은체크아웃] ${action} 실패:`, err);
      showMessage(stage, i18n.errorMessage);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadLanguageData();
  if (!i18n) return;
  // 공용 버튼("처음으로")은 키오스크의 app.js에만 있다. QR 사이트에는 없으므로
  // 있을 때만 부른다 — 이 파일을 두 사이트에서 같은 내용으로 쓰기 위한 장치.
  if (typeof createCommonButtons === "function") createCommonButtons();

  // QR 사이트에는 키오스크의 "처음으로" 버튼이 없으므로, 손님이 FAQ로 돌아갈
  // 길을 만들어준다(#lcBack은 QR 사이트 HTML에만 있다).
  const back = document.getElementById("lcBack");
  if (back) {
    back.innerHTML =
      `<a class="lc-back-link" href="${withCurrentLang("QnA.html")}">← ${i18n.backToFaq}</a>`;
  }

  renderNameStep(document.getElementById("lateCheckoutStage"));
  // ⚠️ 예약 목록을 여기서 받아두지 않는다(2026-08-26). 조회는 서버가 하고
  // 그 손님 한 건만 돌려주므로, 브라우저는 예약 데이터를 아예 갖지 않는다.
  // 손님 휴대폰(QR)에서 열려도 전 투숙객 명단이 내려가지 않는 이유가 이것이다.
});
