// ============================================================
// API 통신 라이브러리 (api.js)
// ============================================================
// 채팅 서버와 통신하는 모든 fetch 함수를 이 파일에서 관리합니다.
//
// 설계 원칙:
//   - 서버 주소는 환경변수(NEXT_PUBLIC_API_URL)에서만 읽어옵니다.
//   - 모든 인증 요청은 Authorization 헤더에 JWT 토큰을 포함합니다.
//   - 토큰 만료 시 자동으로 로그인 페이지로 이동합니다.
// ============================================================

// 서버 기본 주소 — 환경변수에서 읽기
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';


/**
 * [내부] localStorage에서 저장된 JWT 토큰을 가져옵니다.
 * @returns {string|null} 토큰 문자열 또는 null
 */
function getToken() {
    if (typeof window === 'undefined') return null;  // SSR 환경 대비
    return localStorage.getItem('yakorea_admin_token');
}


/**
 * [내부] 인증 토큰이 포함된 기본 헤더를 반환합니다.
 * @returns {Object} headers 객체
 */
function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}


/**
 * [내부] API 응답을 처리합니다.
 * 401 응답 시 토큰을 삭제하고 로그인 페이지로 이동합니다.
 *
 * @param {Response} res - fetch 응답 객체
 * @returns {Promise<Object>} 파싱된 JSON 데이터
 */
async function handleResponse(res) {
    if (res.status === 401) {
        // 인증 실패 → 토큰 삭제 후 로그인 페이지로 이동
        localStorage.removeItem('yakorea_admin_token');
        window.location.href = '/login';
        throw new Error('인증이 필요합니다.');
    }

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || `서버 에러 (${res.status})`);
    }

    return data;
}


// ============================================================
// 인증 API
// ============================================================

/**
 * 로그인합니다.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, manager: Object }>}
 */
export async function login(email, password) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password })
    });
    return handleResponse(res);
}


/**
 * 현재 로그인된 관리자 정보를 조회합니다.
 * @returns {Promise<{ manager: Object }>}
 */
export async function getMe() {
    const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: authHeaders()
    });
    return handleResponse(res);
}


// ============================================================
// 대화방 API
// ============================================================

/**
 * 전체 대화방 목록을 조회합니다. (관리자용)
 * @param {{ status?: string, limit?: number }} params
 * @returns {Promise<{ rooms: Array, total: number }>}
 */
export async function getRooms(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res   = await fetch(`${API_URL}/api/chat/admin/rooms${query ? '?' + query : ''}`, {
        headers: authHeaders()
    });
    return handleResponse(res);
}


/**
 * 특정 대화방의 메시지 목록을 조회합니다.
 * @param {string} roomId - 대화방 UUID
 * @returns {Promise<{ messages: Array }>}
 */
export async function getMessages(roomId) {
    const res = await fetch(`${API_URL}/api/chat/rooms/${roomId}/messages`, {
        headers: authHeaders()
    });
    return handleResponse(res);
}


/**
 * 대화방 상태를 변경합니다.
 * @param {string} roomId
 * @param {Object} updates - { status?, is_manager_connected? }
 * @returns {Promise<{ room: Object }>}
 */
export async function updateRoom(roomId, updates) {
    const res = await fetch(`${API_URL}/api/chat/admin/rooms/${roomId}`, {
        method:  'PATCH',
        headers: authHeaders(),
        body:    JSON.stringify(updates)
    });
    return handleResponse(res);
}


// ============================================================
// FAQ 의도 API
// ============================================================

/**
 * 전체 FAQ 의도 목록을 조회합니다.
 * @returns {Promise<{ intents: Array }>}
 */
export async function getIntents() {
    const res = await fetch(`${API_URL}/api/admin/intents`, {
        headers: authHeaders()
    });
    return handleResponse(res);
}


/**
 * 특정 FAQ 의도의 상세 정보를 조회합니다. (질문/답변 포함)
 * @param {string} intentId
 * @returns {Promise<{ intent: Object, questions: Array, answers: Array }>}
 */
export async function getIntentDetail(intentId) {
    const res = await fetch(`${API_URL}/api/admin/intents/${intentId}`, {
        headers: authHeaders()
    });
    return handleResponse(res);
}


/**
 * FAQ 의도 활성화/비활성화 상태를 변경합니다.
 * @param {string} intentId
 * @param {boolean} isActive
 * @returns {Promise<{ intent: Object }>}
 */
export async function toggleIntent(intentId, isActive) {
    const res = await fetch(`${API_URL}/api/admin/intents/${intentId}`, {
        method:  'PATCH',
        headers: authHeaders(),
        body:    JSON.stringify({ is_active: isActive })
    });
    return handleResponse(res);
}


/**
 * 유사 질문을 추가합니다.
 * @param {string} intentId
 * @param {{ language: string, question_text: string }} data
 * @returns {Promise<{ question: Object }>}
 */
export async function addQuestion(intentId, data) {
    const res = await fetch(`${API_URL}/api/admin/intents/${intentId}/questions`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify(data)
    });
    return handleResponse(res);
}


/**
 * 유사 질문을 삭제합니다.
 * @param {string} intentId
 * @param {string} questionId
 */
export async function deleteQuestion(intentId, questionId) {
    const res = await fetch(`${API_URL}/api/admin/intents/${intentId}/questions/${questionId}`, {
        method:  'DELETE',
        headers: authHeaders()
    });
    return handleResponse(res);
}


/**
 * 언어별 답변 템플릿을 저장합니다. (없으면 생성, 있으면 수정)
 * @param {string} intentId
 * @param {string} lang      - ko | en | zh | ja
 * @param {string} template  - 답변 템플릿 ({{변수}} 포함 가능)
 * @returns {Promise<{ answer: Object }>}
 */
export async function saveAnswer(intentId, lang, template) {
    const res = await fetch(`${API_URL}/api/admin/intents/${intentId}/answers/${lang}`, {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify({ answer_template: template })
    });
    return handleResponse(res);
}


// ============================================================
// 운영 설정 API
// ============================================================

/**
 * 전체 운영 설정을 조회합니다.
 * @param {{ category?: string }} params
 * @returns {Promise<{ settings: Array }>}
 */
export async function getSettings(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res   = await fetch(`${API_URL}/api/admin/settings${query ? '?' + query : ''}`, {
        headers: authHeaders()
    });
    return handleResponse(res);
}


/**
 * 특정 설정값을 변경합니다.
 * @param {string} key   - 설정 키
 * @param {string} value - 새 값
 * @returns {Promise<{ setting: Object }>}
 */
export async function updateSetting(key, value) {
    const res = await fetch(`${API_URL}/api/admin/settings/${key}`, {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify({ value })
    });
    return handleResponse(res);
}
