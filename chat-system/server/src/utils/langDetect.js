// 매니저 답변 언어 판별기 (정규식 기반, 외부 호출 0)
//
// 매니저는 한국어/영어/중국어 중 하나로 답한다.
// 중국어 답변일 때만 비-중국어 손님 언어로 번역하므로,
// 한자(Hanzi)·한글(Hangul) 유무로 빠르게 분류.
//
// 한국어가 한자를 섞어 쓰는 경우는 거의 없으므로 한글 우선 검사.

const HANGUL_RE = /[가-힯]/;        // 가-힯 (현대 한글 음절)
const HANZI_RE = /[一-鿿]/;         // 一-鿿 (CJK Unified Ideographs)

function detectManagerLang(text) {
  if (!text || typeof text !== 'string') return 'en';
  if (HANGUL_RE.test(text)) return 'ko';
  if (HANZI_RE.test(text)) return 'zh';
  return 'en';
}

module.exports = { detectManagerLang };
