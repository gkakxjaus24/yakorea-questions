// ============================================================
// Socket.IO 클라이언트 (socket.js)
// ============================================================
// 관리자 페이지에서 서버와의 실시간 통신을 담당합니다.
//
// 싱글톤 패턴으로 소켓 인스턴스를 하나만 유지합니다.
// (페이지 이동 시에도 연결이 끊기지 않습니다)
// ============================================================

// io는 브라우저에서만 사용 가능하므로 런타임에 로드합니다.
// Next.js의 SSR(서버 사이드 렌더링)과 충돌을 피하기 위함입니다.
let socket = null;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';


/**
 * Socket.IO 소켓 인스턴스를 반환합니다.
 * 이미 연결되어 있으면 기존 인스턴스를 재사용합니다. (싱글톤)
 *
 * @returns {import('socket.io-client').Socket}
 */
export function getSocket() {
    if (socket) return socket;

    // 동적 import로 SSR 충돌 방지
    const { io } = require('socket.io-client');

    socket = io(API_URL, {
        transports:            ['websocket', 'polling'],
        reconnectionAttempts:  10,
        reconnectionDelay:     2000
    });

    // 연결 이벤트 로그 (개발 편의용)
    socket.on('connect',    () => console.log('[Admin Socket] 연결됨:', socket.id));
    socket.on('disconnect', () => console.log('[Admin Socket] 연결 해제'));
    socket.on('error',      (err) => console.error('[Admin Socket] 에러:', err));

    return socket;
}


/**
 * 매니저 채널에 조인합니다.
 * 관리자 페이지 최초 진입 시 호출하여 알림을 받을 준비를 합니다.
 */
export function joinManagerChannel() {
    const s = getSocket();
    s.emit('manager:join');
}


/**
 * 특정 대화방에 조인합니다.
 * 대화방 상세 페이지 진입 시 호출합니다.
 *
 * @param {string} roomId - 대화방 UUID
 */
export function joinRoom(roomId) {
    const s = getSocket();
    s.emit('manager:join_room', { roomId });
}


/**
 * 손님에게 답장을 보냅니다.
 *
 * @param {string} roomId  - 대화방 UUID
 * @param {string} content - 답장 내용
 */
export function sendReply(roomId, content) {
    const s = getSocket();
    s.emit('manager:send_reply', { roomId, content });
}


/**
 * 대화방을 종료합니다.
 * 서버에서 상태 변경 + 손님 위젯에 종료 알림을 보냅니다.
 *
 * @param {string} roomId - 대화방 UUID
 */
export function closeRoom(roomId) {
    const s = getSocket();
    s.emit('manager:close_room', { roomId });
}
