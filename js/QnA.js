let i18n;
let koQna = []; // 클릭 통계용 — 표시 언어와 무관하게 한국어 원문으로 질문을 식별

const FAQ_STATS_API = "https://projectclaude-production-5351.up.railway.app";

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

// ✅ FAQ 클릭 통계 — 답변을 열람할 때만 기록(닫을 때는 제외), 실패해도 UI에 영향 없음
function reportFaqClick(index) {
  const questionKo = koQna[index]?.q;
  if (!questionKo) return;
  fetch(`${FAQ_STATS_API}/api/faq/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: isNoChat() ? "link" : "qr",
      question_ko: questionKo,
      lang: getLanguageFromURL(),
    }),
  }).catch(() => {});
}

function renderQuestionText(item) {
  if (item.keyword) {
    const idx = item.q.indexOf(item.keyword);
    if (idx >= 0) {
      const before = item.q.slice(0, idx);
      const after  = item.q.slice(idx + item.keyword.length);
      return (before ? `<span class="sub">${before}</span>` : '')
           + `<span class="kw">${item.keyword}</span>`
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
  ko: (range, rate) => `지난주(${range}) 수건 반납률: ${rate}% 달성.`,
  en: (range, rate) => `Last week (${range}) towel return rate: ${rate}%.`,
  zh: (range, rate) => `上周(${range})毛巾归还率：${rate}%。`,
  ja: (range, rate) => `先週(${range})のタオル返却率：${rate}%。`,
  ru: (range, rate) => `На прошлой неделе (${range}) процент возврата полотенец: ${rate}%.`,
  es: (range, rate) => `La semana pasada (${range}) tasa de devolución de toallas: ${rate}%.`,
  mn: (range, rate) => `Өнгөрсөн долоо хоногт (${range}) алчуур буцаах хувь: ${rate}%.`,
  vi: (range, rate) => `Tuần trước (${range}) tỷ lệ trả khăn: ${rate}%.`,
  fr: (range, rate) => `La semaine dernière (${range}) taux de retour des serviettes : ${rate}%.`,
  de: (range, rate) => `Letzte Woche (${range}) Rücklaufquote der Handtücher: ${rate}%.`,
  ar: (range, rate) => `الأسبوع الماضي (${range}) معدل إعادة المناشف: ${rate}%.`,
  tr: (range, rate) => `Geçen hafta (${range}) havlu iade oranı: %${rate}.`,
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
  return build(range, rate);
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
        </div>`;
    }
  }

  document.querySelector(".container").innerHTML = qnaHTML;
  addEventListeners();
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

function renderFeedbackForm() {
  const fb = i18n.feedback;
  if (!fb) return;

  const area = getAreaFromURL();
  const rooms = getRoomsForArea(area);

  const section = document.createElement("section");
  section.id = "feedback-section";
  section.innerHTML = `
    <h2 class="category-heading">${fb.title}</h2>
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
    <textarea id="feedback-content" placeholder="${fb.placeholder}" rows="4"></textarea>
    <p id="feedback-error" class="feedback-error hidden"></p>
    <button id="feedback-submit" class="feedback-submit-btn">${fb.submitBtn}</button>
    <p id="feedback-success" class="feedback-success hidden">${fb.successMsg}</p>
  `;
  document.querySelector(".container").insertAdjacentElement("afterend", section);

  const roomSelect = section.querySelector("#feedback-room");
  const bedWrap = section.querySelector("#feedback-bed-wrap");
  const bedSelect = section.querySelector("#feedback-bed");
  const contentEl = section.querySelector("#feedback-content");
  const errorEl = section.querySelector("#feedback-error");
  const successEl = section.querySelector("#feedback-success");
  const submitBtn = section.querySelector("#feedback-submit");

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

document.addEventListener("DOMContentLoaded", async () => {
  const loaded = await loadLanguageData();
  if (!loaded || !i18n) {
    document.querySelector(".container").innerHTML =
      '<p style="padding:20px;text-align:center;color:#999">데이터를 불러오지 못했습니다. 페이지를 새로고침 해주세요.<br>Could not load data. Please refresh the page.</p>';
    return;
  }
  await updateUI();
  renderFeedbackForm();
});
