const supabase = require('../services/supabase');
const faqMatcher = require('../services/faqMatcher');
const telegram = require('../services/telegram');

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10분
const idleTimers = new Map(); // roomId -> setTimeout

// 야간 시간대(KST 00:00~08:00) — 매니저/직원 휴식 시간
function isNightTimeKST() {
  const kstMs = Date.now() + 9 * 3600 * 1000;
  const kstHour = new Date(kstMs).getUTCHours();
  return kstHour >= 0 && kstHour < 8;
}

const NIGHT_MESSAGE =
  '현재 야간 시간(00:00~08:00)입니다. 직원과 매니저가 휴식 중이라 자동응답만 가능합니다.\n' +
  '급한 문의는 카운터 010-5747-1294로 전화 주세요.\n\n' +
  '[EN] It is currently night time (00:00~08:00 KST). Only auto-responses are available. ' +
  'For urgent matters, please call the front desk at 010-5747-1294.';

// roomId → roomLabel / guestName 인메모리 맵
const roomLabelMap = new Map();
const guestNameMap = new Map();

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
      io.emit('room:activity', {
        roomId, status: 'closed', timestamp: new Date().toISOString(),
        roomLabel: roomLabelMap.get(roomId) || '',
      });
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
  socket.on('guest:join', async ({ roomId, guestId, roomLabel, guestName }) => {
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
      socket.roomLabel = roomLabel || '';
      socket.guestName = guestName || '';

      if (roomLabel) roomLabelMap.set(room.id, roomLabel);
      if (guestName) guestNameMap.set(room.id, guestName);

      socket.emit('room:created', { roomId: room.id, status: room.status });
      console.log(`[Guest] ${socket.id} joined room ${room.id} (status: ${room.status}, label: ${roomLabel || '-'}, name: ${guestName || '-'})`);
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

      const roomLabel = roomLabelMap.get(roomId) || '';
      const guestName = guestNameMap.get(roomId) || '';

      // 같은 방의 매니저에게 전달
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
        roomLabel, guestName,
      });

      // 유휴 타임아웃 리셋
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
        // 야간(KST 00:00~08:00)은 매니저 연결 불가 — 자동 안내만
        if (isNightTimeKST()) {
          await supabase.from('messages').insert({
            room_id: roomId,
            sender_type: 'auto',
            content: NIGHT_MESSAGE,
          });
          socket.emit('auto:response', { content: NIGHT_MESSAGE, confidence: 0 });
          console.log(`[Guest] night-time auto-reply in room ${roomId}`);
        } else {
          // escalate → 방 상태 waiting 으로 변경
          await supabase
            .from('chat_rooms')
            .update({ status: 'waiting', updated_at: new Date().toISOString() })
            .eq('id', roomId);
          io.emit('room:activity', { roomId, status: 'waiting', timestamp: new Date().toISOString(), roomLabel });
          socket.emit('auto:escalate', {});
          socket.emit('room:status', { status: 'waiting' });
          telegram.alertEscalation(roomId, roomLabel, guestName);
        }
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
      const roomLabel = roomLabelMap.get(roomId) || '';
      const guestName = guestNameMap.get(roomId) || '';
      await supabase
        .from('chat_rooms')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', roomId);

      io.to(roomId).emit('room:closed', { by: 'guest' });
      io.emit('room:activity', { roomId, status: 'closed', timestamp: new Date().toISOString(), roomLabel });

      console.log(`[Guest] closed room ${roomId}`);
    } catch (err) {
      console.error('[guest:close_room] error:', err.message);
    }
  });
};

module.exports.roomLabelMap = roomLabelMap;
module.exports.guestNameMap = guestNameMap;
