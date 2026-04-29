const supabase = require('../services/supabase');
const translateService = require('../services/translateService');
const { detectManagerLang } = require('../utils/langDetect');

const MANAGER_LANGS = ['ko', 'en', 'zh'];

module.exports = function managerHandler(io, socket) {
  // 매니저 소켓 등록
  socket.on('manager:join', ({ managerId }) => {
    socket.managerId = managerId || socket.id;
    console.log(`[Manager] ${socket.id} registered as ${socket.managerId}`);
  });

  // 특정 채팅방 입장 (핵심 — 손님과 같은 room에 있어야 메시지 전달됨)
  socket.on('manager:join_room', async ({ roomId }) => {
    try {
      socket.join(roomId);
      socket.currentRoomId = roomId;

      // 방 상태를 'active'로 업데이트
      await supabase
        .from('chat_rooms')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', roomId);

      // 상태 변경 브로드캐스트 (위젯 상태 배지 + 관리자 목록 갱신)
      io.to(roomId).emit('room:status', { status: 'active' });
      io.emit('room:activity', { roomId, status: 'active', timestamp: new Date().toISOString() });

      // 기존 메시지 히스토리 전송
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      socket.emit('room:history', { messages: messages || [] });
      console.log(`[Manager] ${socket.id} joined room ${roomId}`);
    } catch (err) {
      console.error('[manager:join_room] error:', err.message);
    }
  });

  // 매니저 → 손님 답장
  socket.on('manager:send_reply', async ({ roomId, content }) => {
    try {
      const { data: msg, error } = await supabase
        .from('messages')
        .insert({ room_id: roomId, sender_type: 'manager', content })
        .select()
        .single();
      if (error) throw error;

      // --- Backward 번역 (매니저 → 손님) ---
      // 조건: 매니저가 중국어로 답했고 + 손님이 비-{ko,en,zh} 언어 사용 + 플래그 ON
      let translated = null;
      let originalLang = null;
      const managerLang = detectManagerLang(content);
      if (managerLang === 'zh') {
        // 손님 언어 조회
        const { data: room } = await supabase
          .from('chat_rooms')
          .select('guest_lang')
          .eq('id', roomId)
          .maybeSingle();
        const guestLang = room?.guest_lang;
        if (guestLang && !MANAGER_LANGS.includes(guestLang) && (await translateService.isEnabled())) {
          const r = await translateService.translate({
            text: content,
            sourceLang: 'zh',
            targetLang: guestLang,
            roomId,
            direction: 'backward',
          });
          if (r.ok) {
            translated = r.translated;
            originalLang = 'zh';
            await supabase
              .from('messages')
              .update({ content_translated: translated, original_lang: originalLang })
              .eq('id', msg.id);
          }
        }
      }

      // 같은 방의 손님에게 전달 (번역문 있으면 같이)
      socket.to(roomId).emit('manager:message', {
        content: msg.content,
        translated,
        originalLang,
        timestamp: msg.created_at,
      });

      console.log(`[Manager] reply in room ${roomId}: ${content}` +
        (translated ? ` (translated → ${originalLang ? '?' : ''})` : ''));
    } catch (err) {
      console.error('[manager:send_reply] error:', err.message);
    }
  });

  // 매니저가 대화 종료
  socket.on('manager:close_room', async ({ roomId }) => {
    try {
      await supabase
        .from('chat_rooms')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', roomId);

      // 방의 모든 참여자에게 종료 알림
      io.to(roomId).emit('room:closed', { by: 'manager' });
      // 관리자 목록 페이지 상태 배지 갱신
      io.emit('room:activity', { roomId, status: 'closed', timestamp: new Date().toISOString() });

      console.log(`[Manager] closed room ${roomId}`);
    } catch (err) {
      console.error('[manager:close_room] error:', err.message);
    }
  });
};
