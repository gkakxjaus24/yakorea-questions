// ============================================================
// 채팅 라우트 (chat.js)
// ============================================================
// 대화방 생성/조회 및 메시지 내역 조회 API를 담당합니다.
//
// 엔드포인트:
//   POST   /api/chat/rooms          — 새 대화방 생성 (손님 위젯에서 호출)
//   GET    /api/chat/rooms/:id      — 특정 대화방 정보 조회
//   GET    /api/chat/rooms/:id/messages — 대화방 메시지 목록 조회
//   GET    /api/chat/admin/rooms    — 관리자용 전체 대화방 목록 조회
//   PATCH  /api/chat/admin/rooms/:id — 관리자용 대화방 상태 변경
// ============================================================

const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../db/supabase');


// ============================================================
// 손님용 엔드포인트
// ============================================================

/**
 * POST /api/chat/rooms
 * 새 대화방을 생성하거나 기존 세션의 대화방을 반환합니다.
 *
 * 요청 본문: { sessionId: string, language: string }
 * 응답: { room: Object }
 */
router.post('/rooms', async (req, res) => {
    const { sessionId, language = 'ko' } = req.body;

    // sessionId가 없으면 대화방을 만들 수 없음
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId가 필요합니다.' });
    }

    try {
        // 같은 세션 ID로 이미 활성화된 대화방이 있으면 재사용
        const { data: existing } = await supabaseAdmin
            .from('chat_rooms')
            .select('*')
            .eq('guest_session_id', sessionId)
            .neq('status', 'closed')      // 종료된 방은 제외
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (existing) {
            // 기존 대화방 반환
            return res.json({ room: existing, isNew: false });
        }

        // 새 대화방 생성
        const { data: newRoom, error } = await supabaseAdmin
            .from('chat_rooms')
            .insert({
                guest_session_id: sessionId,
                language:         language,
                status:           'active'
            })
            .select()
            .single();

        if (error) throw error;

        // 환영 메시지 자동 삽입
        const welcomeTexts = {
            ko: '안녕하세요! 야코리아입니다. 무엇을 도와드릴까요?',
            en: 'Hello! Welcome to Yakorea. How can we help you?',
            zh: '您好！欢迎来到Yakorea。有什么可以帮您的？',
            ja: 'こんにちは！Yakoreaへようこそ。何かお手伝いできますか？'
        };

        await supabaseAdmin
            .from('messages')
            .insert({
                chat_room_id:  newRoom.id,
                sender_type:   'system',
                content:       welcomeTexts[language] ?? welcomeTexts.ko,
                is_auto_reply: false,
                is_read:       false
            });

        res.status(201).json({ room: newRoom, isNew: true });

    } catch (err) {
        console.error('[Chat] 대화방 생성 에러:', err.message);
        // 디버깅용: 실제 에러 메시지 노출 (확인 후 제거 예정)
        res.status(500).json({ error: '대화방 생성에 실패했습니다.', debug: err.message });
    }
});


/**
 * GET /api/chat/rooms/:id
 * 특정 대화방 정보를 조회합니다.
 *
 * 응답: { room: Object }
 */
router.get('/rooms/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: room, error } = await supabaseAdmin
            .from('chat_rooms')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !room) {
            return res.status(404).json({ error: '대화방을 찾을 수 없습니다.' });
        }

        res.json({ room });

    } catch (err) {
        console.error('[Chat] 대화방 조회 에러:', err.message);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});


/**
 * GET /api/chat/rooms/:id/messages
 * 특정 대화방의 메시지 목록을 조회합니다.
 *
 * 쿼리 파라미터: limit (기본 50), before (커서 기반 페이지네이션용 created_at)
 * 응답: { messages: Array }
 */
router.get('/rooms/:id/messages', async (req, res) => {
    const { id }    = req.params;
    const limit     = Math.min(parseInt(req.query.limit) || 50, 100);  // 최대 100개
    const before    = req.query.before;  // 이 시간 이전의 메시지만 (무한 스크롤용)

    try {
        let query = supabaseAdmin
            .from('messages')
            .select('*')
            .eq('chat_room_id', id)
            .order('created_at', { ascending: true })  // 오래된 메시지부터
            .limit(limit);

        // before 파라미터가 있으면 해당 시간 이전 메시지만 조회 (페이지네이션)
        if (before) {
            query = query.lt('created_at', before);
        }

        const { data: messages, error } = await query;
        if (error) throw error;

        res.json({ messages: messages || [] });

    } catch (err) {
        console.error('[Chat] 메시지 조회 에러:', err.message);
        res.status(500).json({ error: '메시지 조회에 실패했습니다.' });
    }
});


/**
 * PATCH /api/chat/rooms/:id/close
 * 대화방을 종료 상태로 변경합니다. (손님이 "대화 종료" 버튼 클릭 시)
 *
 * 응답: { success: true }
 */
router.patch('/rooms/:id/close', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabaseAdmin
            .from('chat_rooms')
            .update({ status: 'closed', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });

    } catch (err) {
        console.error('[Chat] 대화방 종료 에러:', err.message);
        res.status(500).json({ error: '대화방 종료에 실패했습니다.' });
    }
});


// ============================================================
// 관리자용 엔드포인트
// ============================================================

/**
 * GET /api/chat/admin/rooms
 * 관리자용 전체 대화방 목록 조회.
 * 최근 활동 순으로 정렬하여 반환합니다.
 *
 * 쿼리 파라미터: status (all | active | waiting_manager | closed), limit
 * 응답: { rooms: Array, total: number }
 */
router.get('/admin/rooms', async (req, res) => {
    const { status, limit = 50 } = req.query;

    try {
        let query = supabaseAdmin
            .from('chat_rooms')
            .select('*', { count: 'exact' })
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(Math.min(parseInt(limit), 100));

        // 상태 필터 적용
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: rooms, count, error } = await query;
        if (error) throw error;

        res.json({ rooms: rooms || [], total: count || 0 });

    } catch (err) {
        console.error('[Chat] 관리자 대화방 목록 조회 에러:', err.message);
        res.status(500).json({ error: '대화방 목록 조회에 실패했습니다.' });
    }
});


/**
 * PATCH /api/chat/admin/rooms/:id
 * 관리자가 대화방 상태를 수동으로 변경합니다.
 *
 * 요청 본문: { status?: string, is_manager_connected?: boolean }
 * 응답: { room: Object }
 */
router.patch('/admin/rooms/:id', async (req, res) => {
    const { id }    = req.params;
    const updates   = {};

    // 허용된 필드만 업데이트 (임의 필드 수정 방지)
    if (req.body.status !== undefined)              updates.status              = req.body.status;
    if (req.body.is_manager_connected !== undefined) updates.is_manager_connected = req.body.is_manager_connected;
    updates.updated_at = new Date().toISOString();

    try {
        const { data: room, error } = await supabaseAdmin
            .from('chat_rooms')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ room });

    } catch (err) {
        console.error('[Chat] 대화방 상태 변경 에러:', err.message);
        res.status(500).json({ error: '상태 변경에 실패했습니다.' });
    }
});


module.exports = router;
