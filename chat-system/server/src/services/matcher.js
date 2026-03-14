// ============================================================
// 텍스트 유사도 매처 (matcher.js)
// ============================================================
// 손님이 보낸 메시지와 FAQ에 등록된 유사 질문을 비교하여
// 가장 적합한 의도(intent)를 찾아내는 핵심 엔진입니다.
//
// 매칭 방식:
//   1단계: 정확 매칭 — 전처리 후 완전 일치 여부 확인 (신뢰도 1.0)
//   2단계: 유사도 — Jaccard 유사도 + 부분문자열 보너스 점수 합산
//
// 설계 원칙:
//   - 순수 함수로 구성 (외부 의존성 없음, 테스트 용이)
//   - 추후 다른 매칭 알고리즘(ML, 임베딩 등)으로 교체 가능한 구조
// ============================================================


/**
 * [유틸] 텍스트 전처리
 *
 * 매칭 정확도를 높이기 위해 텍스트를 정규화합니다:
 * - 소문자 변환 (영어)
 * - 앞뒤 공백 제거
 * - 연속 공백 → 공백 1개
 * - 물음표 계열 문장부호 통일 (！？。→ ?)
 * - 마침표/콤마 등 제거
 * - 이모지 제거
 * - 반복 문자 축소 (ㅋㅋㅋ → ㅋ, ??? → ?)
 *
 * @param {string} text - 원본 텍스트
 * @returns {string} 전처리된 텍스트
 */
function preprocessText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')                           // 연속 공백 → 공백 1개
        .replace(/[！？。!?~]+/g, '?')                   // 물음표 계열 통일
        .replace(/[.,;:…·、。]+/g, '')                   // 마침표/콤마 등 제거
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')          // 이모지 제거
        .replace(/(.)\1{2,}/g, '$1')                    // 반복 문자 축소
        .trim();
}


/**
 * [유틸] 텍스트를 토큰(검색 단위) 집합으로 변환
 *
 * 언어별 특성을 고려한 토큰화:
 * - 영어/숫자: 공백 기준 단어 분리
 * - 한국어/중국어/일본어: 바이그램(2글자씩 겹쳐 분리)
 *   → 공백 없이 붙여 쓰는 한중일은 바이그램이 더 효과적
 *   예: "체크인" → {"체크인", "체크", "크인"}
 *
 * @param {string} text - 전처리된 텍스트
 * @returns {Set<string>} 토큰 집합
 */
function tokenize(text) {
    if (!text) return new Set();
    const tokens = new Set();
    const words = text.split(/\s+/);

    words.forEach(word => {
        if (word.length === 0) return;
        tokens.add(word);  // 단어 전체도 토큰으로 추가

        // 한국어/중국어/일본어 문자가 포함된 단어면 바이그램 추가
        const isCJK = /[\uAC00-\uD7AF\u3000-\u9FFF\u3040-\u30FF]/.test(word);
        if (isCJK) {
            for (let i = 0; i < word.length - 1; i++) {
                tokens.add(word.substring(i, i + 2));  // 2글자씩 겹쳐서 추출
            }
        }
    });

    return tokens;
}


/**
 * [핵심] Jaccard 유사도 계산
 *
 * 두 토큰 집합의 교집합 / 합집합 비율로 유사도를 측정합니다.
 * 결과 범위: 0.0 (완전히 다름) ~ 1.0 (완전히 같음)
 *
 * @param {Set<string>} setA - 토큰 집합 A
 * @param {Set<string>} setB - 토큰 집합 B
 * @returns {number} 유사도 (0.0 ~ 1.0)
 */
function jaccardSimilarity(setA, setB) {
    if (setA.size === 0 && setB.size === 0) return 0;

    // 교집합 계산: A에도 있고 B에도 있는 토큰 수
    let intersection = 0;
    for (const token of setA) {
        if (setB.has(token)) intersection++;
    }

    // 합집합 크기 = A + B - 교집합 (중복 제거)
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}


/**
 * [보조] 부분 문자열 포함 보너스 점수
 *
 * 한쪽 텍스트가 다른 쪽에 완전히 포함되거나,
 * 핵심 단어들이 상당수 포함되면 추가 점수를 부여합니다.
 *
 * @param {string} textA - 전처리된 텍스트 A
 * @param {string} textB - 전처리된 텍스트 B
 * @returns {number} 보너스 점수 (0.0 ~ 0.3)
 */
function substringBonus(textA, textB) {
    // 한쪽이 다른 쪽을 완전히 포함하면 큰 보너스
    if (textA.includes(textB) || textB.includes(textA)) return 0.3;

    // 2글자 이상 단어 기준 키워드 포함 비율
    const wordsA = textA.split(/\s+/).filter(w => w.length >= 2);
    const wordsB = textB.split(/\s+/).filter(w => w.length >= 2);
    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    // B의 단어들이 A 텍스트에 얼마나 포함되는지 계산
    const matchCount = wordsB.filter(word => textA.includes(word)).length;
    return (matchCount / wordsB.length) * 0.2;  // 최대 0.2 보너스
}


/**
 * [메인] 손님 메시지에 가장 적합한 FAQ 의도(intent)를 찾습니다.
 *
 * 처리 순서:
 *   1. 정확 매칭 (전처리 후 완전 일치) → 신뢰도 1.0
 *   2. Jaccard 유사도 + 부분문자열 보너스 + 동일 언어 보너스
 *
 * @param {string} userMessage      - 손님이 보낸 메시지 원본
 * @param {Array}  intentQuestions  - 등록된 유사 질문 배열
 *   각 항목: { intent_id: string, language: string, question_text: string }
 * @param {string} language         - 손님의 선택 언어 (ko, en, zh, ja)
 *
 * @returns {Object} 매칭 결과
 *   {
 *     matched:         boolean,  // 의미있는 매칭이 됐는지
 *     intentId:        string,   // 매칭된 의도 ID
 *     confidence:      number,   // 신뢰도 (0.000 ~ 1.000)
 *     matchedQuestion: string    // 매칭된 유사 질문 텍스트
 *   }
 */
function findBestMatch(userMessage, intentQuestions, language) {
    // 빈 메시지 처리
    const processedInput = preprocessText(userMessage);
    if (!processedInput) {
        return { matched: false, intentId: null, confidence: 0, matchedQuestion: null };
    }

    // ===== 1단계: 정확 매칭 =====
    for (const q of intentQuestions) {
        if (preprocessText(q.question_text) === processedInput) {
            return {
                matched:         true,
                intentId:        q.intent_id,
                confidence:      1.0,            // 완전 일치 = 신뢰도 100%
                matchedQuestion: q.question_text
            };
        }
    }

    // ===== 2단계: 유사도 비교 =====
    const inputTokens = tokenize(processedInput);
    let best = { intentId: null, confidence: 0, matchedQuestion: null };

    for (const q of intentQuestions) {
        const processedQ = preprocessText(q.question_text);
        const qTokens    = tokenize(processedQ);

        // Jaccard 유사도
        const jaccard = jaccardSimilarity(inputTokens, qTokens);

        // 부분 문자열 포함 보너스
        const bonus = substringBonus(processedInput, processedQ);

        // 같은 언어면 소폭 보너스 (다국어 질문이 혼재할 때 우선순위 보정)
        const langBonus = (q.language === language) ? 0.05 : 0;

        // 최종 점수 (최대 1.0으로 제한)
        const score = Math.min(jaccard + bonus + langBonus, 1.0);

        if (score > best.confidence) {
            best = { intentId: q.intent_id, confidence: score, matchedQuestion: q.question_text };
        }
    }

    return {
        matched:         best.confidence > 0,
        intentId:        best.intentId,
        confidence:      Math.round(best.confidence * 1000) / 1000,  // 소수점 3자리
        matchedQuestion: best.matchedQuestion
    };
}


module.exports = {
    preprocessText,
    tokenize,
    jaccardSimilarity,
    substringBonus,
    findBestMatch
};
