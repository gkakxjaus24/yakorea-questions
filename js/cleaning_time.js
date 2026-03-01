let i18n;

async function loadLanguageData() {
  i18n = await loadI18n("../data/cleaning_time.json");
  return !!i18n;
}


function updateUI() {
  const mainContent = `
    <main class="grid-container" style="font-size: 20px">
      <div class="grid-item notice">
        ${i18n.mainNotice}
      </div>
      <div class="grid-item bag-storage">
        ${i18n.bagStorage}
      </div>
      <div class="grid-item">
        <div class="button-container">
          <div id="common-buttons"></div>
        </div>
      </div>
    </main>
  `;

  // 제목 업데이트
  const headline = document.querySelector(".headline");
  if (headline) {
    headline.innerHTML = i18n.title;
  }

  // 메인 컨텐츠 업데이트
  const mainContainer = document.querySelector("main");
  if (mainContainer) {
    mainContainer.outerHTML = mainContent;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadLanguageData();
  updateUI();
  createCommonButtons(); // 공통 버튼 생성
});

document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  const hour = now.getHours();

  // 오전 5시~11시 사이라면 제목('청소시간') 숨기기
  if (hour >= 5 && hour < 11) {
    const headline = document.querySelector(".headline");
    if (headline) headline.style.display = "none";
  }
});