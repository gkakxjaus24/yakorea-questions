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
