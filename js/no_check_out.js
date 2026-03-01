let i18n;

async function loadLanguageData() {
  i18n = await loadI18n("../data/no_check_out.json");
  return !!i18n;
}


function updateUI() {
  const mainContent = `
    <main class="grid-container">
      <div class="grid-item notice" style="font-size: ${i18n.mainNoticeFontSize || "25px"}">
        ${i18n.mainNotice}
      </div>
      <div class="grid-item bag-storage" style="font-size: ${i18n.bagStorageFontSize || "25px"}">
        ${i18n.bagStorage}
      </div>
      <div class="grid-item">
        <button class="self-checkin-button" onclick="location.href='${i18n.nextPage}'">
          ${i18n.buttonText}
        </button>
      </div>
      <div class="grid-item">
        <button class="self-checkin-button" onclick="location.href='${i18n.earlyNextPage}'">
          ${i18n.earlyButtonText}
        </button>
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
