/* checkin_out_selection.js */
document.addEventListener("DOMContentLoaded", async () => {
    // 공통 버튼 (HOME, HELP) 생성
    if (typeof createCommonButtons === "function") {
        createCommonButtons();
    }

    // i18n 데이터 로드
    const langCode = getLanguageFromURL();
    const i18n = await loadI18n("../data/checkin_out_selection.json");

    if (i18n) {
        // 텍스트 적용
        document.querySelector(".headline").innerHTML = i18n.title || "";
        document.getElementById("btn-checkin").innerHTML = i18n.checkinButton || "";
        document.getElementById("btn-checkout").innerHTML = i18n.checkoutButton || "";
    }

    // 버튼 이벤트 연결
    document.getElementById("btn-checkin").addEventListener("click", () => {
        window.location.href = `cleaning_time.html?lang=${langCode}`;
    });

    document.getElementById("btn-checkout").addEventListener("click", () => {
        window.location.href = `no_check_out.html?lang=${langCode}`;
    });
});
