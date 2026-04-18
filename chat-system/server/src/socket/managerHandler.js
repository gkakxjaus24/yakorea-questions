const supabase = require('../services/supabase');

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

      // 같은 방의 손님에게 전달
      socket.to(roomId).emit('manager:message', {
        content: msg.content,
        timestamp: msg.created_at,
      });

      console.log(`[Manager] reply in room ${roomId}: ${content}`);
    } catch (err) {
      console.error('[manager:send_reply] error:', err.message);
    }
  });
};
