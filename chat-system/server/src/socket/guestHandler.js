const supabase = require('../services/supabase');
const faqMatcher = require('../services/faqMatcher');

module.exports = function guestHandler(io, socket) {
  // 손님 입장 — roomId 없으면 신규 방 생성
  socket.on('guest:join', async ({ roomId, guestId }) => {
    try {
      let room;

      if (roomId) {
        const { data } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('id', roomId)
          .single();
        room = data;
      }

      if (!room) {
        const { data, error } = await supabase
          .from('chat_rooms')
          .insert({ guest_id: guestId || socket.id, status: 'auto' })
          .select()
          .single();
        if (error) throw error;
        room = data;
      }

      socket.join(room.id);
      socket.roomId = room.id;
      socket.guestId = guestId || socket.id;

      socket.emit('room:created', { roomId: room.id });
      console.log(`[Guest] ${socket.id} joined room ${room.id}`);
    } catch (err) {
      console.error('[guest:join] error:', err.message);
    }
  });

  // 손님 메시지 전송
  socket.on('guest:send_message', async ({ roomId, content }) => {
    try {
      const { data: msg, error } = await supabase
        .from('messages')
        .insert({ room_id: roomId, sender_type: 'guest', content })
        .select()
        .single();
      if (error) throw error;

      // 같은 방의 매니저에게 전달
      socket.to(roomId).emit('guest:message', {
        content: msg.content,
        timestamp: msg.created_at,
      });

      // FAQ 자동응답
      const result = await faqMatcher.match(content);
      if (result.type === 'auto') {
        await supabase.from('messages').insert({
          room_id: roomId,
          sender_type: 'auto',
          content: result.faq.answer,
        });
        socket.emit('auto:response', {
          content: result.faq.answer,
          confidence: result.confidence,
        });
      } else if (result.type === 'candidates') {
        socket.emit('auto:candidates', { candidates: result.candidates });
      } else {
        socket.emit('auto:escalate', {});
      }

      console.log(`[Guest] message in room ${roomId}: ${content} → FAQ: ${result.type}`);
    } catch (err) {
      console.error('[guest:send_message] error:', err.message);
    }
  });
};
