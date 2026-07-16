let i18n;
let koQna = []; // 클릭 통계용 — 표시 언어와 무관하게 한국어 원문으로 질문을 식별

const FAQ_STATS_API = "https://projectclaude-production-5351.up.railway.app";

function getLanguageFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("lang") || "ko";
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
      source: "qr",
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

  // 클릭 통계는 언어와 무관한 원본 배열 인덱스(_idx)로 질문을 식별하므로,
  // 카테고리별로 재그룹핑해도 원래 위치를 잃지 않도록 미리 붙여둔다.
  const grouped = i18n.qna.reduce((acc, item, idx) => {
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
