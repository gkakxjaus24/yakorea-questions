const supabase = require('../services/supabase');
const faqMatcher = require('../services/faqMatcher');

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10분
const idleTimers = new Map(); // roomId -> setTimeout

function clearIdleTimer(roomId) {
  const t = idleTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    idleTimers.delete(roomId);
  }
}

function scheduleIdleClose(io, roomId) {
  clearIdleTimer(roomId);
  const timer = setTimeout(async () => {
    try {
      await supabase
        .from('chat_rooms')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', roomId);
      io.to(roomId).emit('room:closed', { by: 'idle_timeout' });
      io.emit('room:activity', { roomId, status: 'closed', timestamp: new Date().toISOString() });
      console.log(`[Guest] idle timeout closed room ${roomId}`);
    } catch (err) {
      console.error('[idle timeout] error:', err.message);
    } finally {
      idleTimers.delete(roomId);
    }
  }, IDLE_TIMEOUT_MS);
  idleTimers.set(roomId, timer);
}

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
        // 종료된 방이면 재사용하지 않고 새 방 생성
        if (data && data.status !== 'closed') {
          room = data;
        }
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

      socket.emit('room:created', { roomId: room.id, status: room.status });
      console.log(`[Guest] ${socket.id} joined room ${room.id} (status: ${room.status})`);
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

      // 같은 방의 매니저에게 전달 (이미 room에 조인한 매니저용)
      socket.to(roomId).emit('guest:message', {
        content: msg.content,
        timestamp: msg.created_at,
      });

      // 방 updated_at 갱신
      await supabase
        .from('chat_rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', roomId);

      // 관리자 목록 페이지 전체에 알림
      io.emit('room:activity', {
        roomId,
        guestId: socket.guestId || socket.id,
        content: msg.content,
        timestamp: msg.created_at,
      });

      // 유휴 타임아웃 리셋 (손님 입력 기준)
      scheduleIdleClose(io, roomId);

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
        // escalate → 방 상태 waiting 으로 변경
        await supabase
          .from('chat_rooms')
          .update({ status: 'waiting', updated_at: new Date().toISOString() })
          .eq('id', roomId);
        io.emit('room:activity', { roomId, status: 'waiting', timestamp: new Date().toISOString() });
        socket.emit('auto:escalate', {});
        socket.emit('room:status', { status: 'waiting' });
      }

      console.log(`[Guest] message in room ${roomId}: ${content} → FAQ: ${result.type}`);
    } catch (err) {
      console.error('[guest:send_message] error:', err.message);
    }
  });

  // 손님이 대화 종료
  socket.on('guest:close_room', async ({ roomId }) => {
    try {
      clearIdleTimer(roomId);
      await supabase
        .from('chat_rooms')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', roomId);

      io.to(roomId).emit('room:closed', { by: 'guest' });
      io.emit('room:activity', { roomId, status: 'closed', timestamp: new Date().toISOString() });

      console.log(`[Guest] closed room ${roomId}`);
    } catch (err) {
      console.error('[guest:close_room] error:', err.message);
    }
  });
};
