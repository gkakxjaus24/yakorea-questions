/* ============================================================
   ✅ 공통 유틸리티 함수
   - 모든 페이지 JS에서 공유합니다. 수정은 여기 한 곳에서만.
   ============================================================ */

/**
 * URL의 ?lang= 파라미터를 읽어 언어 코드를 반환합니다.
 * 없으면 기본값 "ko"를 반환합니다.
 * @returns {string} 언어 코드 (예: "ko", "en", "zh", "ja")
 */
function getLanguageFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("lang") || "ko";
}

/**
 * i18n 문자열 템플릿에서 변수를 치환합니다.
 * 예: t("안녕 {name}!", { name: "앨빈" }) → "안녕 앨빈!"
 * @param {string} template  - 치환할 템플릿 문자열
 * @param {Object} vars      - 치환할 변수 객체
 * @returns {string}
 */
function t(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/**
 * JSON 파일을 fetch하여 현재 언어의 i18n 데이터를 반환합니다.
 * - document.documentElement.lang 도 자동으로 설정합니다.
 * - 언어 코드가 없으면 "ko"로 fallback합니다.
 * @param {string} url - fetch할 JSON 파일 경로 (예: "../data/QnA.json")
 * @returns {Promise<Object|null>} i18n 객체, 실패 시 null
 */
async function loadI18n(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const langCode = getLanguageFromURL();
    document.documentElement.lang = langCode;
    const result = data[langCode] || data.ko;
    if (!result) throw new Error(`언어 코드 "${langCode}" 없음, "ko" fallback도 없음`);
    return result;
  } catch (e) {
    console.error(`[i18n] 로드 실패 (${url}, lang=${getLanguageFromURL()}):`, e);
    document.documentElement.lang = "ko";
    return null;
  }
}

// ✅ 공통 버튼 생성 함수
function createCommonButtons() {
  const buttonContainer = document.getElementById("common-buttons");
  const currentPage = window.location.pathname.split("/").pop();

  if (buttonContainer) {
    // "처음으로" 버튼 (메인 페이지에서는 표시하지 않음)
    if (currentPage !== "main.html") {
      const homeButton = document.createElement("button");
      homeButton.className = "common-button";
      homeButton.innerHTML = "🏠 HOME";
      homeButton.onclick = function () {
        window.location.href = "/pages/main.html";
      };
      buttonContainer.appendChild(homeButton);
    }

    // "도움요청" 버튼 (메인 페이지와 QnA 페이지에서는 표시하지 않음)
    if (!currentPage.startsWith("QnA") && currentPage !== "main.html") {
      const helpButton = document.createElement("button");
      helpButton.className = "common-button help-button";
      helpButton.innerHTML = "❓ HELP";
      helpButton.onclick = function () {
        const urlParams = new URLSearchParams(window.location.search);
        const lang = urlParams.get("lang") || "ko";
        window.location.href = `/pages/QnA.html?lang=${lang}`;
      };
      buttonContainer.appendChild(helpButton);
    }
  }
}

// ✅ 언어 선택 버튼 생성 함수
function createLanguageButtons() {
  const languageContainer = document.getElementById("language-buttons");
  if (!languageContainer) {
    console.error("language-buttons 컨테이너가 없습니다.");
    return;
  }

  const languages = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
    { code: "zh", label: "中文" },
    { code: "ja", label: "日本語" },
  ];

  languages.forEach((lang) => {
    const button = document.createElement("button");
    button.className = "language-button";
    button.textContent = lang.label;
    button.onclick = function () {
      // 프로젝트에 setLanguage가 있으면 그대로 사용, 없으면 URL 파라미터로 변경
      if (typeof setLanguage === "function") {
        setLanguage(lang.code);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set("lang", lang.code);
        window.location.href = url.toString();
      }
    };
    languageContainer.appendChild(button);
  });
}

// ✅ 비활동 상태 감지 후 메인 페이지로 이동(쿼리/해시 보존 + 캐시버스터)
let inactivityTimer;
function goHomePreserveQueryAndHash() {
  try {
    const target = new URL("/pages/main.html", location.origin);
    const cur = new URL(location.href);
    if (cur.search) target.search = cur.search;
    if (cur.hash) target.hash = cur.hash;
    target.searchParams.set("_r", Date.now().toString()); // 캐시 무력화
    window.location.replace(target.toString()); // 히스토리 누적 방지
  } catch {
    window.location.href = "/pages/main.html?_r=" + Date.now();
  }
}
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    goHomePreserveQueryAndHash();
  }, 60_000); // 1분 (60,000ms)
}

// ✅ 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", function () {
  // createCommonButtons(); // 공통 버튼 생성 (필요 시 주석 해제)

  // 메인 페이지가 아닐 경우 비활동 타이머 설정
  if (!window.location.href.includes("/pages/main.html")) {
    resetInactivityTimer();
    document.addEventListener("mousemove", resetInactivityTimer);
    document.addEventListener("mousedown", resetInactivityTimer);
    document.addEventListener("keypress", resetInactivityTimer);
    document.addEventListener("touchstart", resetInactivityTimer);
    document.addEventListener("scroll", resetInactivityTimer);
  }
});

/* ============================================================
   ✅ 매일 지정 시각 자동 새로고침(캐시 무시) - 프론트엔드만으로 구현
   - 기본 시간: 14:59 (체크인 15:00 직전)
   - 여러 시간 지원: ["14:55","03:10"] 처럼 추가 가능
   - Asia/Seoul 기준(로컬 PC 시간이 곧 기준)
   ============================================================ */
(function setupDailyAutoReload() {
  const ENABLE_AUTO_RELOAD = true; // 요청: true 유지
  const AUTO_RELOAD_AT = ["14:59"]; // 원하는 시간들 추가 가능 ["14:55","03:10"]

  if (!ENABLE_AUTO_RELOAD || !Array.isArray(AUTO_RELOAD_AT) || AUTO_RELOAD_AT.length === 0) return;

  function msUntilNext(hh, mm) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hh, mm, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }

  function reloadWithBust() {
    const url = new URL(window.location.href);
    url.searchParams.set("_bust", Date.now().toString()); // 캐시 무력화
    window.location.replace(url.toString()); // 히스토리 누적 방지
  }

  AUTO_RELOAD_AT.forEach((timeStr) => {
    const [HH, MM] = String(timeStr).split(":").map(Number);
    if (Number.isInteger(HH) && Number.isInteger(MM)) {
      setTimeout(function tick() {
        reloadWithBust();
        setInterval(reloadWithBust, 24 * 60 * 60 * 1000); // 이후 매일 반복
      }, msUntilNext(HH, MM));
    } else {
      console.warn(`[autoReload] 올바르지 않은 시간 형식: "${timeStr}" (예: "14:59")`);
    }
  });
})();

/* ============================================================
   ✅ 10분마다 메인으로 복귀(입력 중이면 건너뜀) + 쿼리/해시 보존 + 캐시버스터
   - 1-2) 항상 /pages/main.html 로 이동
   - 2-2) 입력 중이면 이번 회차 건너뜀
   - 3-1) 쿼리/해시 보존
   - 5-1) 캐시버스터 파라미터 추가
   ============================================================ */
(function () {
  const INTERVAL = 10 * 60 * 1000; // 10분
  const MAIN = "/pages/main.html";

  function isTypingNow() {
    const a = document.activeElement;
    if (!a) return false;
    if (a.isContentEditable) return true;
    const tag = a.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      if (a.type && ["button", "submit", "checkbox", "radio"].includes(a.type)) return false;
      return true;
    }
    return false;
  }

  function goHomeHardPreserveQueryAndHash() {
    try {
      const target = new URL(MAIN, location.origin);
      const cur = new URL(location.href);

      // 3-1) 쿼리와 해시 보존
      if (cur.search) target.search = cur.search;
      if (cur.hash) target.hash = cur.hash;

      // 5-1) 캐시버스터 파라미터 추가
      target.searchParams.set("_r", Date.now().toString());

      // 히스토리 누적 방지
      location.replace(target.toString());
    } catch {
      location.href = MAIN + "?_r=" + Date.now();
    }
  }

  setInterval(() => {
    // 2-2) 입력 중이면 연기
    if (isTypingNow()) return;
    goHomeHardPreserveQueryAndHash();
  }, INTERVAL);
})();
