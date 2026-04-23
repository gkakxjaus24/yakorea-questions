let i18n;

function getLanguageFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("lang") || "ko";
}

async function loadLanguageData() {
  try {
    const response = await fetch("data/QnA.json");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    const langCode = getLanguageFromURL();

    document.documentElement.lang = langCode;
    i18n = data[langCode] || data.ko;

    return true;
  } catch (error) {
    console.error("언어 데이터 로드 중 오류 발생:", error);
    document.documentElement.lang = "ko";
    return false;
  }
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
    });
  });
}

async function updateUI() {
  document.querySelector(".headline").innerHTML = i18n.title;

  const grouped = i18n.qna.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  let qnaHTML = "";

  for (const category in grouped) {
    qnaHTML += `<h2 class="category-heading">${category}</h2>`;
    for (const item of grouped[category]) {
      qnaHTML += `
        <div class="question">${renderQuestionText(item)}</div>
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
  await loadLanguageData();
  await updateUI();
});
