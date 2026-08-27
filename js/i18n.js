/* ============================================================
   ✅ 다국어 (i18n) 유틸리티 함수
   - 언어 설정, 다국어 데이터 로드 및 텍스트 치환
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
 * 다음 페이지 URL의 lang 파라미터를 현재 선택된 언어로 보정합니다.
 *
 * 키오스크 설계 의도: 첫 화면에서 고른 언어는 그 뒤의 모든 안내 화면에 그대로
 * 이어져야 합니다. 그런데 일부 데이터(JSON)의 이동 URL에는 lang 값이 하드코딩돼
 * 있어(예: 아랍어인데 ?lang=en) 언어가 끊기는 문제가 있었습니다. 이 함수는
 * 목적지 경로는 그대로 두고 lang만 항상 "현재 URL의 실제 언어"로 덮어써서
 * 어떤 데이터가 와도 선택 언어가 유지되도록 보장합니다.
 *
 * @param {string} pageUrl - 이동할 페이지 URL (예: "cleaning_time.html?lang=en")
 * @returns {string} lang이 현재 언어로 교체된 URL
 */
function withCurrentLang(pageUrl) {
  const lang = getLanguageFromURL();
  const [path, query = ""] = String(pageUrl).split("?");
  const params = new URLSearchParams(query);
  params.set("lang", lang);
  return `${path}?${params.toString()}`;
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
    // RTL 언어 자동 처리 — 아랍어 등은 우→좌 흐름
    const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];
    document.documentElement.dir = RTL_LANGS.includes(langCode) ? 'rtl' : 'ltr';
    const result = data[langCode] || data.ko;
    if (!result) throw new Error(`언어 코드 "${langCode}" 없음, "ko" fallback도 없음`);
    return result;
  } catch (e) {
    console.error(`[i18n] 로드 실패 (${url}, lang=${getLanguageFromURL()}):`, e);
    document.documentElement.lang = "ko";
    return null;
  }
}
