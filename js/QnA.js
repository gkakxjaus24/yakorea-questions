let i18n;
let koQna = []; // 클릭 통계용 — 표시 언어와 무관하게 한국어 원문으로 질문을 식별

const FAQ_STATS_API = "https://projectclaude-production-5351.up.railway.app";

function getLanguageFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("lang") || "ko";
}

// 구역별 QR 코드 구분용 — ?area=privateA|privateB|dorm|dormBasement|common
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

  for (const category in grouped) {
    qnaHTML += `<h2 class="category-heading">${category}</h2>`;
    for (const item of grouped[category]) {
      qnaHTML += `
        <div class="question" data-idx="${item._idx}">${renderQuestionText(item)}</div>
        <div class="answer" style="display: none">
          ${item.a}
          ${item.media ? renderMedia(item.media, item.mediaType) : ''}
        </div>`;
    }
  }

  document.querySelector(".container").innerHTML = qnaHTML;
  addEventListeners();
}

document.addEventListener("DOMContentLoaded", async () => {
  const loaded = await loadLanguageData();
  if (!loaded || !i18n) {
    document.querySelector(".container").innerHTML =
      '<p style="padding:20px;text-align:center;color:#999">데이터를 불러오지 못했습니다. 페이지를 새로고침 해주세요.<br>Could not load data. Please refresh the page.</p>';
    return;
  }
  await updateUI();
});
