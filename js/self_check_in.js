let i18n;

async function loadLanguageData() {
  i18n = await loadI18n("../data/self_check_in.json");
  return !!i18n;
}


function updateUI() {
  // 언어 코드 가져오기
  const langCode = getLanguageFromURL();

  // grid-item 요소 찾기
  const gridItems = document.querySelectorAll(".grid-item");
  if (gridItems.length >= 2) {
    // 두 번째 grid-item에 버튼 추가
    gridItems[1].innerHTML = `
      <button
        class="self-checkin-button"
        onclick="location.href='${i18n.nextPage}'"
      >
        ${i18n.buttonText}
      </button>
    `;
  }

  // 제목 업데이트
  const headline = document.querySelector(".headline");
  if (headline) {
    headline.innerHTML = i18n.title;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadLanguageData();
  updateUI();
  createCommonButtons(); // 공통 버튼 생성
});
