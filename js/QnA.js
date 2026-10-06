let i18n;
let koQna = []; // 클릭 통계용 — 표시 언어와 무관하게 한국어 원문으로 질문을 식별

// 로컬 테스트용: 개발 PC(localhost) 또는 같은 와이파이의 사설 IP(폰으로 테스트할 때)에서 열었을 때만
// ?api=http://그주소:3001 로 서버를 바꿀 수 있다. 운영 주소에서는 이 파라미터를 무시한다 —
// 남이 링크로 서버를 바꿔치기하지 못하게.
const FAQ_STATS_API = (() => {
  const prod = "https://projectclaude-production-5351.up.railway.app";
  const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;
  const override = new URLSearchParams(location.search).get("api");
  if (!override || !LOCAL_HOST.test(location.hostname)) return prod;
  try {
    const u = new URL(override);
    return u.protocol === "http:" && LOCAL_HOST.test(u.hostname) && !u.pathname.replace("/", "") ? u.origin : prod;
  } catch (_) {
    return prod;
  }
})();

function getLanguageFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("lang") || "ko";
}

// 구역별 QR 코드 구분용 — ?area=privateA|privateB|dorm|dormBasement|common|frontDesk
function getAreaFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("area") || null;
}

// 이메일 링크(?nochat=1)로 들어온 경우 — 채팅 위젯이 아예 없으므로
// "채팅 버튼을 눌러주세요" 안내 질문(hideWhen: "nochat")은 숨긴다.
function isNoChat() {
  return new URLSearchParams(window.location.search).get("nochat") === "1";
}

// ?preview=1 — 운영자가 손님 화면을 그대로 확인하는 미리보기 모드(2026-08-30).
// 화면과 동작은 손님과 완전히 같고, 통계 기록만 전부 건너뛴다.
// (QR 열람·FAQ 클릭·LLM 폴백·건의사항 — 각 기록 지점에서 이 함수를 확인한다.)
// 운영자가 직접 QR을 찍어보면 통계가 오염되므로 그걸 피하려는 목적.
function isPreview() {
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

async function loadLanguageData() {
  try {
    const response = await fetch("/data/QnA.json");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    const langCode = getLanguageFromURL();

    document.documentElement.lang = langCode;
    i18n = data[langCode] || data.ko;
    koQna = data.ko?.qna || [];

    return true;
  } catch (error) {
    console.error("언어 데이터 로드 중 오류 발생:", error);
    document.documentElement.lang = "ko";
    return false;
  }
}

// 채팅 위젯이 QR 열람을 기록할 때 sessionStorage에 넣는 탭 단위 id.
// 여기서는 읽기만 한다 — 두 곳에서 만들면 같은 탭에 다른 id가 생겨
// "QR을 찍은 손님이 질문까지 눌렀나"를 이어붙일 수 없게 된다.
const QR_SID_KEY = "ya_qr_sid";
function getQrSid() {
  try {
    return sessionStorage.getItem(QR_SID_KEY) || null;
  } catch (_) {
    return null; // 사파리 프라이빗 모드 등에서 막히면 sid 없이 보낸다
  }
}

// ✅ FAQ 클릭 통계 — 답변을 열람할 때만 기록(닫을 때는 제외), 실패해도 UI에 영향 없음
// area/sid는 어드민 통합 통계의 퍼널용(2026-08-30). 어느 구역 QR에서 어떤 질문을
// 눌렀는지, QR을 찍은 손님이 실제로 질문까지 갔는지를 보려는 목적. 둘 다 없어도
// 서버가 기록은 그대로 한다.
function reportFaqClick(index) {
  const questionKo = koQna[index]?.q;
  if (!questionKo) return;
  if (isPreview()) return; // 미리보기 — 통계에 남기지 않는다
  fetch(`${FAQ_STATS_API}/api/faq/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: isNoChat() ? "link" : "qr",
      question_ko: questionKo,
      lang: getLanguageFromURL(),
      area: getAreaFromURL(),
      sid: getQrSid(),
    }),
  }).catch(() => {});
}

// item.highlight === true면 검은 볼드(.kw) 대신 주황 볼드(.kw-hl)로 — 자주 묻는
// 질문/강조하고 싶은 질문을 다른 항목보다 눈에 띄게 함(2026-08-27, 키오스크 js/QnA.js와 동일).
function renderQuestionText(item) {
  if (item.keyword) {
    const idx = item.q.indexOf(item.keyword);
    if (idx >= 0) {
      const before = item.q.slice(0, idx);
      const after  = item.q.slice(idx + item.keyword.length);
      const kwClass = item.highlight ? 'kw-hl' : 'kw';
      return (before ? `<span class="sub">${before}</span>` : '')
           + `<span class="${kwClass}">${item.keyword}</span>`
           + (after  ? `<span class="sub">${after}</span>`  : '');
    }
  }
  return item.q;
}

// ── 수건 반납률 안내 (수건 FAQ 답변 끝 {{towelRate}} 치환용) ──────────
// 실측: 최근 몇 주간 반납률이 대체로 98~100% 사이(사장님 확인). 그 범위 안에서
// 매주 하나를 결정적으로 골라 보여준다. 같은 주엔 항상 같은 값, 저장 없이 순수 계산.
// (chat-system/server/src/services/faqMatcher.js의 서버 버전과 로직 동일 — 텍스트도 맞춰둠)
const TOWEL_RATES = [98, 99, 100];
const TOWEL_NOTE_TEXT = {
  ko: (range, rate) => `지난주(${range}) 수건 반납률: ${rate}%`,
  en: (range, rate) => `Last week (${range}) towel return rate: ${rate}%`,
  zh: (range, rate) => `上周(${range})毛巾归还率：${rate}%`,
  ja: (range, rate) => `先週(${range})のタオル返却率：${rate}%`,
  ru: (range, rate) => `На прошлой неделе (${range}) процент возврата полотенец: ${rate}%`,
  es: (range, rate) => `La semana pasada (${range}) tasa de devolución de toallas: ${rate}%`,
  mn: (range, rate) => `Өнгөрсөн долоо хоногт (${range}) алчуур буцаах хувь: ${rate}%`,
  vi: (range, rate) => `Tuần trước (${range}) tỷ lệ trả khăn: ${rate}%`,
  fr: (range, rate) => `La semaine dernière (${range}) taux de retour des serviettes : ${rate}%`,
  de: (range, rate) => `Letzte Woche (${range}) Rücklaufquote der Handtücher: ${rate}%`,
  ar: (range, rate) => `الأسبوع الماضي (${range}) معدل إعادة المناشف: ${rate}%`,
  tr: (range, rate) => `Geçen hafta (${range}) havlu iade oranı: %${rate}`,
};

function hashInt(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return n >>> 0;
}

function getTowelReturnNote(lang) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - diffToMonday);
  thisMonday.setUTCHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setUTCDate(thisMonday.getUTCDate() - 1);

  const fmt = (d) => `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
  const range = `${fmt(lastMonday)}-${fmt(lastSunday)}`;

  const weekSeed = Math.floor(lastMonday.getTime() / (7 * 24 * 3600 * 1000));
  const rate = TOWEL_RATES[hashInt(weekSeed) % TOWEL_RATES.length];

  const build = TOWEL_NOTE_TEXT[lang] || TOWEL_NOTE_TEXT.ko;
  return `<span style="color:#d32f2f">[${build(range, rate)}]</span>`;
}

// 답변 텍스트 안의 {{towelRate}}를 실제 안내문으로 치환 (없으면 그대로 반환)
function injectTowelReturnNote(text, lang) {
  if (!text.includes("{{towelRate}}")) return text;
  return text.replace("{{towelRate}}", getTowelReturnNote(lang));
}

function renderMedia(src, type) {
  if (!src) return '';
  if (type === 'video') {
    return `<div class="media-container"><video src="${src}" controls></video></div>`;
  }
  return `<div class="media-container"><img src="${src}" alt="" /></div>`;
}

// 답변 안의 액션 버튼 — 답변에서 다른 페이지로 보내는 CTA.
// (2026-09-02 늦은 체크아웃 폐지로 현재 쓰는 FAQ 항목은 없지만, 기능은 그대로 둔다.)
// item.action = { label, url }. url은 lang 없이 저장해두고 지금 보고 있는 언어를
// 여기서 이어붙인다(키오스크 js/QnA.js의 renderAction과 같은 역할).
//
// i18n.js의 withCurrentLang()을 쓰지 않고 여기서 직접 만드는 이유: QnA.html은
// i18n.js를 읽지 않는다(이 파일이 자체 getLanguageFromURL을 갖고 있다).
// 이 버튼 하나 때문에 스크립트를 하나 더 읽게 하지 않는다.
function renderAction(action) {
  if (!action || !action.label || !action.url) return "";
  const params = new URLSearchParams();
  params.set("lang", getLanguageFromURL());
  // 구역 QR(?area=dorm 등)로 들어온 손님이 되돌아올 때 구역이 유지되도록 넘긴다
  const area = getAreaFromURL();
  if (area) params.set("area", area);
  return `<div class="qna-action"><a class="qna-action-btn" href="${action.url}?${params}">${action.label}</a></div>`;
}

// visibleHours: { start: "07:00", end: "10:00" }. 종료 시각은 포함하지 않는다.
// 23:00~05:00처럼 자정을 넘기는 시간대도 지원한다.
function isVisibleAtCurrentTime(item, now = new Date()) {
  if (!item.visibleHours) return true;

  const { start, end } = item.visibleHours;
  const toMinutes = (time) => {
    const [hour, minute] = String(time).split(":").map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)
      || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    return hour * 60 + minute;
  };

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    console.warn("[QnA] Invalid visibleHours; showing item:", item.visibleHours);
    return true;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return startMinutes < endMinutes
    ? currentMinutes >= startMinutes && currentMinutes < endMinutes
    : currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// ── 노출 조건 총괄 게이트 ─────────────────────────────────────
// 질문 하나가 "지금 이 화면에" 보여야 하는지를 한곳에서 판단한다.
// 조건을 새로 추가할 때(요일별/기간별/공지 고정 등) 이 함수만 건드리면 되고,
// updateUI()의 reduce는 항상 isItemVisible() 한 줄만 호출하면 된다.
//
// - item.areas: string[]  — 없으면 모든 구역 공통. 있으면 현재 area와 하나라도 겹쳐야 노출
//   (구역 코드: privateA, privateB, dorm, dormBasement, common)
// - item.visibleHours: { start, end } — 위 isVisibleAtCurrentTime() 참고
// - item.hideWhen: "nochat" — 이메일 링크(?nochat=1)에서는 숨김
function isItemVisible(item, { area, nochat, now = new Date() } = {}) {
  if (item.areas && !item.areas.includes(area)) return false;
  if (!isVisibleAtCurrentTime(item, now)) return false;
  if (item.hideWhen === "nochat" && nochat) return false;
  return true;
}

function addEventListeners() {
  document.querySelectorAll(".question").forEach((question) => {
    question.addEventListener("click", () => {
      document.querySelectorAll(".answer").forEach((answer) => {
        if (answer !== question.nextElementSibling) {
          answer.style.display = "none";
          answer.previousElementSibling.classList.remove("active");
        }
      });

      const answer = question.nextElementSibling;
      const isVisible = answer.style.display === "block";
      answer.style.display = isVisible ? "none" : "block";
      question.classList.toggle("active", !isVisible);
      if (!isVisible) reportFaqClick(Number(question.dataset.idx));
    });
  });
}

async function updateUI() {
  document.querySelector(".headline").innerHTML = i18n.title;

  const area = getAreaFromURL();
  const nochat = isNoChat();

  // 클릭 통계는 언어와 무관한 원본 배열 인덱스(_idx)로 질문을 식별하므로,
  // 카테고리별로 재그룹핑해도 원래 위치를 잃지 않도록 미리 붙여둔다.
  const grouped = i18n.qna.reduce((acc, item, idx) => {
    if (!isItemVisible(item, { area, nochat })) return acc;
    (acc[item.category] = acc[item.category] || []).push({ ...item, _idx: idx });
    return acc;
  }, {});

  let qnaHTML = "";
  const currentLang = getLanguageFromURL();

  for (const category in grouped) {
    qnaHTML += `<h2 class="category-heading">${category}</h2>`;
    for (const item of grouped[category]) {
      qnaHTML += `
        <div class="question" data-idx="${item._idx}">${renderQuestionText(item)}</div>
        <div class="answer" style="display: none">
          ${injectTowelReturnNote(item.a, currentLang)}
          ${item.media ? renderMedia(item.media, item.mediaType) : ''}
          ${renderAction(item.action)}
        </div>`;
    }
  }

  const container = document.querySelector(".container");
  container.innerHTML = qnaHTML;
  addEventListeners();
  wireFaqJumpLinks(container);
}

// 답변 안의 "다른 질문으로 이동" 링크(class="faq-jump-link") 연결 — 키오스크
// js/QnA.js의 wireFaqJumpLinks와 동일한 방식. data-jump-action에 대상 FAQ의
// action.url을 적어두면 그 url을 가진 항목을 찾아 자동으로 펼치고 스크롤해준다
// (하드코딩한 인덱스 대신 url로 찾아 순서 변경에도 안전).
// 2026-09-02 늦은 체크아웃 폐지로 현재 쓰는 항목은 없지만 기능은 그대로 둔다.
function wireFaqJumpLinks(container) {
  const jumpTargetIdx = {};
  i18n.qna.forEach((item, idx) => {
    if (item.action && item.action.url) jumpTargetIdx[item.action.url] = idx;
  });

  container.querySelectorAll(".faq-jump-link").forEach((link) => {
    const targetIdx = jumpTargetIdx[link.dataset.jumpAction];
    if (targetIdx == null) return;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetQuestion = container.querySelector(`.question[data-idx="${targetIdx}"]`);
      if (!targetQuestion) return;
      const targetAnswer = targetQuestion.nextElementSibling;
      if (targetAnswer.style.display !== "block") {
        targetQuestion.click();
      }
      targetQuestion.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ── 건의사항/불만사항 폼 ─────────────────────────────────────────
// 이름은 받지 않는다(익명). 방번호는 필수 — "침대가 이상해요" 같은 불만은
// 몇 호/몇 번 침대인지 몰라 확인 자체가 불가능해지므로, 자유 입력 대신
// 드롭다운으로 정확한 방(도미토리는 침대까지)을 고르게 한다.
const ROOM_LIST = [
  { label: "B1",  dorm: true,  beds: 14, building: "B" },
  { label: "201", dorm: false, building: "A" },
  { label: "202", dorm: false, building: "A" },
  { label: "203", dorm: false, building: "A" },
  { label: "204", dorm: false, building: "A" },
  { label: "205", dorm: true,  beds: 6,  building: "A" },
  { label: "206", dorm: true,  beds: 4,  building: "A" },
  { label: "207", dorm: false, building: "A" },
  { label: "208", dorm: false, building: "A" },
  { label: "209", dorm: false, building: "B" },
  { label: "210", dorm: false, building: "B" },
  { label: "211", dorm: false, building: "B" },
  { label: "212", dorm: false, building: "B" },
  { label: "301", dorm: true,  beds: 4,  building: "A" },
  { label: "302", dorm: false, building: "A" },
  { label: "303", dorm: true,  beds: 4,  building: "A" },
  { label: "304", dorm: false, building: "A" },
  { label: "305", dorm: false, building: "A" },
  { label: "306", dorm: false, building: "B" },
  { label: "307", dorm: false, building: "B" },
  { label: "308", dorm: false, building: "B" },
  { label: "309", dorm: false, building: "B" },
  { label: "401", dorm: false, building: "B" },
  { label: "402", dorm: false, building: "B" },
  { label: "403", dorm: false, building: "B" },
];

// QR 구역 코드에 따라 방 목록을 좁혀준다 — 손님이 고를 항목을 줄여 실수를 막는다.
// privateA/B: 해당 건물 방 전체(그 건물 안의 도미토리 포함, 실제 위치 기준).
// dorm: 두 건물에 흩어진 도미토리만(지하 제외). dormBasement: B1만.
// common/frontDesk/미지정: 어디서 왔는지 특정 못하므로 전체 노출.
function getRoomsForArea(area) {
  if (area === "privateA") return ROOM_LIST.filter((r) => r.building === "A");
  if (area === "privateB") return ROOM_LIST.filter((r) => r.building === "B");
  if (area === "dorm") return ROOM_LIST.filter((r) => r.dorm && r.label !== "B1");
  if (area === "dormBasement") return ROOM_LIST.filter((r) => r.label === "B1");
  return ROOM_LIST;
}

// 건의사항 질문(data/QnA.json의 "건의사항이 있어요" 항목, a: '<div id="feedback-inline-slot">')을
// 아코디언으로 열어야만 보이게 한다 — 손님이 실시간 문의를 이 칸에 잘못 적던 문제가 있었는데,
// 팝업으로 막기보다 애초에 스스로 클릭해서 들어와야 하는 위치로 옮기는 편이 나음(2026-08 결정).
function renderFeedbackFormInto(slot) {
  const fb = i18n.feedback;
  if (!fb) return;

  const area = getAreaFromURL();
  const rooms = getRoomsForArea(area);

  slot.innerHTML = `
    <p class="feedback-disclaimer">${fb.disclaimer}</p>
    <label class="feedback-field-label" for="feedback-room">${fb.roomLabel}</label>
    <select id="feedback-room">
      <option value="">${fb.roomPlaceholder}</option>
      ${rooms.map((r) => `<option value="${r.label}" data-dorm="${r.dorm ? "1" : "0"}" data-beds="${r.beds || 0}">${r.label}</option>`).join("")}
    </select>
    <div id="feedback-bed-wrap" class="hidden">
      <label class="feedback-field-label" for="feedback-bed">${fb.bedLabel}</label>
      <select id="feedback-bed">
        <option value="">${fb.bedPlaceholder}</option>
      </select>
    </div>
    <textarea id="feedback-content" placeholder="${fb.placeholder}" rows="4" readonly></textarea>
    <p id="feedback-error" class="feedback-error hidden"></p>
    <button id="feedback-submit" class="feedback-submit-btn">${fb.submitBtn}</button>
    <p id="feedback-success" class="feedback-success hidden">${fb.successMsg}</p>
  `;

  const roomSelect = slot.querySelector("#feedback-room");
  const bedWrap = slot.querySelector("#feedback-bed-wrap");
  const bedSelect = slot.querySelector("#feedback-bed");
  const contentEl = slot.querySelector("#feedback-content");
  const errorEl = slot.querySelector("#feedback-error");
  const successEl = slot.querySelector("#feedback-success");
  const submitBtn = slot.querySelector("#feedback-submit");

  // 아코디언 질문 클릭 시 열림/닫힘이 토글되므로, 폼 내부 클릭이 그 상위 리스너로
  // 버블링되어 다시 닫히지 않도록 막는다.
  slot.addEventListener("click", (e) => e.stopPropagation());

  // ── "답변 없음 · 채팅 이용" 안내 팝업 ──
  // 8/18 팝업을 없앨 때 이 안내까지 같이 사라져 손님이 이 칸을 채팅처럼 쓰는 일이
  // 늘었다(2026-09-26). 입력칸을 누르면 팝업을 띄우고, "익명 의견 전달"을 골라야만
  // 입력이 풀린다. textarea를 readonly로 시작하는 건 팝업보다 키보드가 먼저 올라오는
  // 것을 막기 위함. 팝업은 아코디언 안이 아니라 body에 붙인다 — 조상 요소의
  // transform/overflow에 position:fixed가 갇히지 않도록.
  document.getElementById("feedback-notice")?.remove();
  const noticeEl = document.createElement("div");
  noticeEl.id = "feedback-notice";
  noticeEl.className = "hidden";
  noticeEl.innerHTML = `
    <div class="feedback-notice-box">
      <p class="feedback-notice-msg">${fb.noticeMsg}</p>
      <button type="button" id="feedback-notice-proceed" class="feedback-notice-btn primary">${fb.proceedBtn}</button>
      <button type="button" id="feedback-notice-chat" class="feedback-notice-btn">${fb.chatBtn}</button>
    </div>
  `;
  document.body.appendChild(noticeEl);

  let noticeAcknowledged = false;
  function openFeedbackNotice() {
    if (noticeAcknowledged) return;
    contentEl.blur();
    noticeEl.classList.remove("hidden");
  }
  contentEl.addEventListener("focus", openFeedbackNotice);
  contentEl.addEventListener("click", openFeedbackNotice);

  // 바깥 어두운 영역을 누르면 아무것도 고르지 않은 채 닫는다(입력은 계속 잠김).
  noticeEl.addEventListener("click", (e) => {
    if (e.target === noticeEl) noticeEl.classList.add("hidden");
  });

  noticeEl.querySelector("#feedback-notice-proceed").addEventListener("click", () => {
    noticeAcknowledged = true;
    noticeEl.classList.add("hidden");
    contentEl.removeAttribute("readonly");
    contentEl.focus();
  });

  // 채팅 위젯은 shadow DOM 안에 있으므로 토글 버튼을 직접 눌러 연다.
  // 토글이라 이미 열린 상태에서 누르면 닫혀버리므로, 닫혀 있을 때만 누른다.
  noticeEl.querySelector("#feedback-notice-chat").addEventListener("click", () => {
    noticeEl.classList.add("hidden");
    const sr = document.getElementById("ya-chat-widget-host")?.shadowRoot;
    const toggleBtn = sr?.getElementById("toggle-btn");
    const chatBox = sr?.getElementById("chat-box");
    if (toggleBtn && (!chatBox || chatBox.classList.contains("hidden"))) toggleBtn.click();
  });

  roomSelect.addEventListener("change", () => {
    const opt = roomSelect.selectedOptions[0];
    const isDorm = opt && opt.dataset.dorm === "1";
    if (!isDorm) {
      bedWrap.classList.add("hidden");
      bedSelect.innerHTML = `<option value="">${fb.bedPlaceholder}</option>`;
      return;
    }
    const beds = Number(opt.dataset.beds) || 0;
    let bedHTML = `<option value="">${fb.bedPlaceholder}</option>`;
    for (let i = 1; i <= beds; i++) bedHTML += `<option value="${i}">${i}</option>`;
    bedSelect.innerHTML = bedHTML;
    bedWrap.classList.remove("hidden");
  });

  submitBtn.addEventListener("click", async () => {
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    const roomVal = roomSelect.value;
    const isDorm = roomSelect.selectedOptions[0]?.dataset.dorm === "1";
    const bedVal = bedSelect.value;
    const content = contentEl.value.trim();

    if (!roomVal || (isDorm && !bedVal)) {
      errorEl.textContent = fb.roomRequiredMsg;
      errorEl.classList.remove("hidden");
      return;
    }
    if (!content) {
      errorEl.textContent = fb.contentRequiredMsg;
      errorEl.classList.remove("hidden");
      return;
    }

    const roomLabel = isDorm ? `${roomVal}-${bedVal}` : roomVal;

    submitBtn.disabled = true;
    try {
      // 미리보기에서는 실제로 보내지 않는다 — 건의사항은 텔레그램 알림까지 나가고
      // 통합 통계 퍼널의 마지막 단계로도 잡히기 때문. 화면 흐름은 그대로 보여준다.
      if (isPreview()) {
        successEl.classList.remove("hidden");
        contentEl.value = "";
        roomSelect.value = "";
        bedWrap.classList.add("hidden");
        return;
      }
      const res = await fetch(`${FAQ_STATS_API}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          roomLabel,
          language: getLanguageFromURL(),
          area: area || "",
        }),
      });
      if (!res.ok) throw new Error("send failed");
      successEl.classList.remove("hidden");
      contentEl.value = "";
      roomSelect.value = "";
      bedWrap.classList.add("hidden");
    } catch {
      errorEl.textContent = fb.errorMsg;
      errorEl.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ── 같은 방 손님 때문에 불편해요 (도미토리 불편 접수, 2026-10-05) ────────────────
// 모든 QR 구역에서 보이는 항목이다(areas 없음, 이메일 링크 nochat만 숨김). 처음엔 도미토리 전용이었으나 개인실·공용공간에서도 생길 수 있어 넓혔다(2026-10-06).
// 같은 방 손님이 다른 사람에게 불편을 주고 있을 때(코골이·냄새·시끄러운 통화 등) 알린다.
// 1건만 접수돼도 사장님·매니저에게 텔레그램이 가고, 조치는 사람이 판단한다(자동 조치 없음).
// 입력은 자유 텍스트 3칸이다(2026-10-06 사장님 요청 — 선택 목록이 복잡하다고 단순화):
//   본인 방-침대번호 / 신고할 사람 방-침대번호(모르면 외모·특징) / 신고 내용
// 본인 방·침대는 직원만 본다 — 신고당한 분에게는 알리지 않는다. deviceId는 같은 사람이
// 여러 번 눌러 "여러 명"처럼 보이는 걸 막는 난수일 뿐이다(localStorage, 개인 식별 정보 아님).
const COMPLAINT_DEVICE_KEY = "ya_complaint_did";

function getComplaintDeviceId() {
  const make = () =>
    (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 32);
  try {
    let id = localStorage.getItem(COMPLAINT_DEVICE_KEY);
    if (!id) {
      id = make();
      localStorage.setItem(COMPLAINT_DEVICE_KEY, id);
    }
    return id;
  } catch (_) {
    return make(); // 저장소가 막혀 있으면 이번 접수만 쓰는 임시 값(중복 방지는 약해진다)
  }
}

function renderComplaintFormInto(slot) {
  const fb = i18n.complaint;
  if (!fb) return;

  const area = getAreaFromURL();

  slot.innerHTML = `
    <p class="complaint-disclaimer">${fb.disclaimer}</p>

    <label class="complaint-label" for="complaint-my-info">${fb.myInfoLabel}</label>
    <input id="complaint-my-info" class="complaint-field" type="text" maxlength="60" autocomplete="off"
      placeholder="${fb.myInfoPlaceholder}" />

    <label class="complaint-label" for="complaint-target-info">${fb.targetInfoLabel}</label>
    <textarea id="complaint-target-info" class="complaint-field" rows="2" maxlength="150"
      placeholder="${fb.targetInfoPlaceholder}"></textarea>

    <label class="complaint-label" for="complaint-content">${fb.contentLabel}</label>
    <textarea id="complaint-content" class="complaint-field" rows="4" maxlength="1000"
      placeholder="${fb.contentPlaceholder}"></textarea>

    <p id="complaint-error" class="feedback-error hidden"></p>
    <button id="complaint-submit" class="feedback-submit-btn">${fb.submitBtn}</button>
    <p id="complaint-success" class="feedback-success hidden">${fb.successMsg}</p>
  `;

  const myInfoEl = slot.querySelector("#complaint-my-info");
  const targetEl = slot.querySelector("#complaint-target-info");
  const contentEl = slot.querySelector("#complaint-content");
  const errorEl = slot.querySelector("#complaint-error");
  const successEl = slot.querySelector("#complaint-success");
  const submitBtn = slot.querySelector("#complaint-submit");

  // 아코디언 질문의 열림/닫힘 토글로 버블링되지 않게 막는다(건의사항 폼과 같은 이유).
  slot.addEventListener("click", (e) => e.stopPropagation());

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  submitBtn.addEventListener("click", async () => {
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    const myInfo = myInfoEl.value.trim();
    const targetInfo = targetEl.value.trim();
    const content = contentEl.value.trim();

    if (!myInfo) return showError(fb.myInfoRequiredMsg);
    if (!targetInfo) return showError(fb.targetInfoRequiredMsg);
    if (!content) return showError(fb.contentRequiredMsg);

    const resetForm = () => {
      successEl.classList.remove("hidden");
      targetEl.value = "";
      contentEl.value = "";
      // 본인 방-침대번호는 그대로 둔다 — 같은 손님이 이어서 다른 사람을 신고할 수 있다
    };

    submitBtn.disabled = true;
    try {
      // 미리보기(?preview=1)에서는 실제로 보내지 않는다 — 텔레그램 알림이 나가기 때문.
      // 화면 흐름은 그대로 보여준다.
      if (isPreview()) return resetForm();
      const res = await fetch(`${FAQ_STATS_API}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterInfo: myInfo,
          targetInfo,
          content,
          language: getLanguageFromURL(),
          area: area || "",
          deviceId: getComplaintDeviceId(),
        }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        return showError(body.error === "duplicate" ? fb.duplicateMsg : fb.limitMsg);
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        return showError(body.error === "same_bed" ? fb.sameBedMsg : fb.errorMsg);
      }
      if (!res.ok) throw new Error("send failed");
      resetForm();
    } catch {
      showError(fb.errorMsg);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const loaded = await loadLanguageData();
  if (!loaded || !i18n) {
    document.querySelector(".container").innerHTML =
      '<p style="padding:20px;text-align:center;color:#999">데이터를 불러오지 못했습니다. 페이지를 새로고침 해주세요.<br>Could not load data. Please refresh the page.</p>';
    return;
  }
  await updateUI();
  // "건의사항이 있어요" 항목의 답변 칸(a: '<div id="feedback-inline-slot">')을 찾아 폼을 채워 넣는다.
  // 이메일 링크(?nochat=1)에서는 해당 항목 자체가 hideWhen으로 숨겨져 slot이 없으므로 자동으로 스킵됨.
  const feedbackSlot = document.getElementById("feedback-inline-slot");
  if (feedbackSlot) renderFeedbackFormInto(feedbackSlot);
  // "같은 방 손님 때문에 불편해요" 항목(도미토리 구역·채팅 가능한 화면에서만 존재)
  const complaintSlot = document.getElementById("complaint-inline-slot");
  if (complaintSlot) renderComplaintFormInto(complaintSlot);
});
