// ============================================================
// 자동응답 서비스 (auto-reply.js)
// ============================================================
// 손님 메시지를 분석하여 FAQ DB와 비교하고, 적절한 자동 답변을
// 찾아 반환하는 핵심 비즈니스 로직입니다.
//
// 처리 흐름:
//   1. DB에서 활성화된 FAQ 의도의 유사 질문 목록 조회
//   2. matcher.js로 가장 적합한 의도 찾기
//   3. 신뢰도에 따라 3단계로 분기:
//      ≥ 높은 임계값  → 자동응답 확정 (답변 즉시 전송)
//      ≥ 낮은 임계값  → 후보 의도 제시 ("이런 질문이신가요?")
//      그 미만        → 자동응답 포기 → 매니저 연결 유도
//   4. 답변 템플릿의 {{변수}} 치환
//   5. DB에 메시지 저장 후 결과 반환
//
// 확장 원칙:
//   - 번역 기능을 추가하려면 processAutoReply 호출 전에
//     translationService.translate(message) 한 줄만 추가하면 됩니다.
//   - 이 파일 자체는 수정하지 않아도 됩니다. (개방-폐쇄 원칙)
// ============================================================

const { supabaseAdmin } = require('../db/supabase');
const { findBestMatch } = require('./matcher');

// 기본 임계값 (DB settings 테이블에서 동적으로 덮어쓸 수 있음)
const DEFAULT_HIGH_THRESHOLD = 0.8;  // 이 이상이면 자동응답 확정
const DEFAULT_LOW_THRESHOLD  = 0.5;  // 이 이상이면 후보 제시


/**
 * [내부] DB에서 자동응답 임계값 설정을 조회합니다.
 * 설정이 없으면 코드 기본값을 사용합니다.
 *
 * @returns {{ high: number, low: number }}
 */
async function getThresholds() {
    try {
        const { data } = await supabaseAdmin
            .from('settings')
            .select('key, value')
            .in('key', ['auto_reply_high_threshold', 'auto_reply_low_threshold']);

        const map = {};
        (data || []).forEach(s => { map[s.key] = parseFloat(s.value); });

        return {
            high: map['auto_reply_high_threshold'] ?? DEFAULT_HIGH_THRESHOLD,
            low:  map['auto_reply_low_threshold']  ?? DEFAULT_LOW_THRESHOLD
        };
    } catch {
        // DB 조회 실패 시 기본값 사용
        return { high: DEFAULT_HIGH_THRESHOLD, low: DEFAULT_LOW_THRESHOLD };
    }
}


/**
 * [내부] 답변 템플릿의 {{변수명}} 자리에 실제 운영 설정값을 삽입합니다.
 *
 * 예시:
 *   입력: "체크인은 {{check_in_time}}부터입니다."
 *   출력: "체크인은 15:00부터입니다."
 *
 * @param {string} template - 답변 템플릿 문자열
 * @returns {Promise<string>} 치환이 완료된 최종 답변
 */
async function replaceTemplateVars(template) {
    if (!template) return '';

    // 템플릿에서 {{변수명}} 패턴 찾기
    const matches = [...template.matchAll(/\{\{(\w+)\}\}/g)];
    if (matches.length === 0) return template;  // 변수 없으면 그대로 반환

    // 필요한 변수 키들만 한 번에 DB 조회 (N+1 쿼리 방지)
    const keys = matches.map(m => m[1]);
    const { data: settings } = await supabaseAdmin
        .from('settings')
        .select('key, value')
        .in('key', keys);

    // key → value 매핑
    const settingsMap = {};
    (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

    // {{변수}} → 실제 값으로 치환 (값이 없으면 원본 {{변수}} 유지)
    let result = template;
    for (const match of matches) {
        const placeholder = match[0];   // "{{check_in_time}}"
        const key         = match[1];   // "check_in_time"
        result = result.replace(placeholder, settingsMap[key] ?? placeholder);
    }

    return result;
}


/**
 * [메인] 손님 메시지를 자동응답 처리합니다.
 *
 * @param {string} userMessage - 손님이 보낸 메시지 원본
 * @param {string} language    - 손님의 언어 코드 (ko, en, zh, ja)
 * @param {string} roomId      - 대화방 UUID
 *
 * @returns {Promise<Object>} 처리 결과
 *   {
 *     type:       'auto_reply' | 'suggest' | 'no_match',
 *     answer:     string | null,         // 전송할 메시지 본문
 *     intentId:   string | null,         // 매칭된 의도 ID
 *     confidence: number,                // 신뢰도 (0.0 ~ 1.0)
 *     message:    Object | null          // DB에 저장된 메시지 레코드
 *   }
 */
async function processAutoReply(userMessage, language, roomId) {
    try {
        // ===== 1. 활성화된 FAQ 의도의 유사 질문 목록 조회 =====
        const { data: activeIntents } = await supabaseAdmin
            .from('intents')
            .select('id')
            .eq('is_active', true);

        if (!activeIntents || activeIntents.length === 0) {
            // 등록된 FAQ가 없으면 자동응답 불가
            return { type: 'no_match', answer: null, intentId: null, confidence: 0, message: null };
        }

        const activeIds = activeIntents.map(i => i.id);

        // 활성 의도에 속한 유사 질문들 조회
        const { data: questions } = await supabaseAdmin
            .from('intent_questions')
            .select('intent_id, language, question_text')
            .in('intent_id', activeIds);

        if (!questions || questions.length === 0) {
            return { type: 'no_match', answer: null, intentId: null, confidence: 0, message: null };
        }

        // ===== 2. 매칭 엔진 실행 =====
        const matchResult = findBestMatch(userMessage, questions, language);
        const thresholds  = await getThresholds();

        // ===== 3-A. 자동응답 확정 (신뢰도 ≥ 높은 임계값) =====
        if (matchResult.confidence >= thresholds.high) {
            // 해당 의도의 답변 템플릿 조회 (손님 언어 우선)
            let { data: answerRow } = await supabaseAdmin
                .from('intent_answers')
                .select('answer_template')
                .eq('intent_id', matchResult.intentId)
                .eq('language', language)
                .single();

            // 손님 언어 답변이 없으면 한국어 답변으로 대체
            if (!answerRow) {
                const { data: koRow } = await supabaseAdmin
                    .from('intent_answers')
                    .select('answer_template')
                    .eq('intent_id', matchResult.intentId)
                    .eq('language', 'ko')
                    .single();
                answerRow = koRow;
            }

            // 답변 자체가 없으면 no_match 처리
            if (!answerRow) {
                return { type: 'no_match', answer: null, intentId: matchResult.intentId, confidence: matchResult.confidence, message: null };
            }

            // {{변수}} → 실제 운영 설정값으로 치환
            const finalAnswer = await replaceTemplateVars(answerRow.answer_template);

            // DB에 자동응답 메시지 저장
            const { data: savedMsg } = await supabaseAdmin
                .from('messages')
                .insert({
                    chat_room_id:      roomId,
                    sender_type:       'system',
                    content:           finalAnswer,
                    is_auto_reply:     true,
                    matched_intent_id: matchResult.intentId,
                    confidence_score:  matchResult.confidence,
                    is_read:           false
                })
                .select()
                .single();

            console.log(`🤖 자동응답 성공 — 의도: ${matchResult.intentId}, 신뢰도: ${matchResult.confidence}`);

            return {
                type:       'auto_reply',
                answer:     finalAnswer,
                intentId:   matchResult.intentId,
                confidence: matchResult.confidence,
                message:    savedMsg
            };
        }

        // ===== 3-B. 후보 제시 (낮은 임계값 ≤ 신뢰도 < 높은 임계값) =====
        if (matchResult.confidence >= thresholds.low) {
            // 매칭된 의도의 카테고리 조회 (안내 메시지에 활용)
            const { data: intent } = await supabaseAdmin
                .from('intents')
                .select('id, category')
                .eq('id', matchResult.intentId)
                .single();

            const category = intent?.category || matchResult.intentId;

            // 언어별 후보 제시 메시지
            const suggestMsgs = {
                ko: `혹시 "${category}" 관련 문의이신가요? 맞으시면 "네"라고 답변해주세요.`,
                en: `Are you asking about "${category}"? Reply "yes" if that's correct.`,
                zh: `您是在询问"${category}"相关问题吗？如果是请回复"是"。`,
                ja: `「${category}」についてのお問い合わせですか？正しければ「はい」とお返事ください。`
            };
            const suggestMsg = suggestMsgs[language] ?? suggestMsgs.ko;

            // DB에 시스템 안내 메시지 저장
            const { data: savedMsg } = await supabaseAdmin
                .from('messages')
                .insert({
                    chat_room_id:      roomId,
                    sender_type:       'system',
                    content:           suggestMsg,
                    is_auto_reply:     false,
                    matched_intent_id: matchResult.intentId,
                    confidence_score:  matchResult.confidence,
                    is_read:           false
                })
                .select()
                .single();

            console.log(`🤔 후보 제시 — 의도: ${matchResult.intentId}, 신뢰도: ${matchResult.confidence}`);

            return {
                type:       'suggest',
                answer:     suggestMsg,
                intentId:   matchResult.intentId,
                confidence: matchResult.confidence,
                message:    savedMsg
            };
        }

        // ===== 3-C. 자동응답 포기 (신뢰도 < 낮은 임계값) =====
        // 나중에 FAQ로 추가할 수 있도록 실패 질문 기록
        await supabaseAdmin
            .from('unmatched_questions')
            .insert({
                question_text: userMessage,
                language:      language,
                status:        'pending'
            });

        console.log(`❌ 자동응답 실패 — 신뢰도: ${matchResult.confidence}`);

        return {
            type:       'no_match',
            answer:     null,
            intentId:   null,
            confidence: matchResult.confidence,
            message:    null
        };

    } catch (error) {
        // 예상치 못한 에러는 안전하게 no_match 처리
        console.error('[AutoReply] 처리 에러:', error.message);
        return { type: 'no_match', answer: null, intentId: null, confidence: 0, message: null };
    }
}


module.exports = {
    processAutoReply,
    replaceTemplateVars,
    getThresholds
};
