let i18n;

async function loadLanguageData() {
  i18n = await loadI18n("../data/QnA.json");
  return !!i18n;
}


function addEventListeners() {
  const questions = document.querySelectorAll(".question");

  questions.forEach((question) => {
    question.addEventListener("click", () => {
      document.querySelectorAll(".answer").forEach((answer) => {
        if (answer !== question.nextElementSibling) {
          answer.style.display = "none";
          answer.previousElementSibling.classList.remove("active");
        }
      });

      const answer = question.nextElementSibling;
      if (answer.style.display === "block") {
        answer.style.display = "none";
        question.classList.remove("active");
      } else {
        answer.style.display = "block";
        question.classList.add("active");
      }
    });
  });
}

// ✅ 동적으로 전화번호 가져오기
async function getHelpPhoneNumber() {
  const now = new Date();
  const hour = now.getHours();
  const myPhone = "010-8240-8892";     // ← 본인 번호로 바꾸세요
  const staffPhone = "010-8240-8892";  // ← 직원 번호로 바꾸세요

  // 밤 11시 ~ 다음날 오후 3시까지는 무조건 내 번호
  if (hour >= 23 || hour < 15) {
    return myPhone;
  }

  // 15시~23시는 스케줄 확인
  try {
    const res = await fetch("../data/staff_schedule.json");
    const schedule = await res.json();
    const today = now.toISOString().split("T")[0];

    const who = schedule[today] || "staff";
    return who === "me" ? myPhone : staffPhone;
  } catch (e) {
    console.error("스케줄 파일 로드 오류:", e);
    return staffPhone;
  }
}

// ✅ 텍스트 안의 {{phone}}을 실제 번호로 치환
async function injectDynamicPhoneNumber(text) {
  const phone = await getHelpPhoneNumber();
  return text.replace("{{phone}}", `☎ ${phone}`);
}

// ✅ 미디어 렌더링
function renderMedia(mediaPath, mediaType) {
  if (mediaType === "video") {
    return `<div class="media-container">
              <video controls src="${mediaPath}"></video>
            </div>`;
  } else {
    return `<div class="media-container">
              <img src="${mediaPath}" alt="미디어 콘텐츠">
            </div>`;
  }
}

// ✅ QnA UI 생성
async function updateUI() {
  const headline = document.querySelector(".headline");
  if (headline) {
    headline.innerHTML = i18n.title;
  }

  const grouped = i18n.qna.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  let qnaHTML = "";
  const promises = [];

  Object.keys(grouped).forEach(category => {
    qnaHTML += `<h2 class="category-heading">${category}</h2>`;
    grouped[category].forEach(item => {
      if (item.dynamicPhone) {
        promises.push(
          injectDynamicPhoneNumber(item.a).then(answerText => {
            qnaHTML += `
              <div class="question">${item.q}</div>
              <div class="answer" style="display: none">
                ${answerText}
                ${item.media ? renderMedia(item.media, item.mediaType) : ''}
              </div>
            `;
          })
        );
      } else {
        qnaHTML += `
          <div class="question">${item.q}</div>
          <div class="answer" style="display: none">
            ${item.a}
            ${item.media ? renderMedia(item.media, item.mediaType) : ''}
          </div>
        `;
      }
    });
  });

  await Promise.all(promises);

  const container = document.querySelector(".container");
  container.innerHTML = qnaHTML;
  addEventListeners();
}

// ✅ 페이지 로드시 실행
document.addEventListener("DOMContentLoaded", async () => {
  await loadLanguageData();
  await updateUI();
  createCommonButtons(); // 공통 버튼 생성 함수 호출
});
