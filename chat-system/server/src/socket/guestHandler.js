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

// 언어별 야간 안내 메시지
const NIGHT_MESSAGES = {
  ko:
    '현재 야간(00:00~08:00)이라 자동응답만 가능합니다.\n' +
    '급한 문의는 1층 카운터 전화기로 010-5747-1294에 걸어주세요.\n' +
    '(카운터 전화만 응답됩니다. 개인 휴대폰은 받지 않습니다.)',
  en:
    'Night hours (00:00–08:00 KST) — auto-reply only.\n' +
    'For urgent matters, call 010-5747-1294 from the 1F front desk phone.\n' +
    '(Only front desk calls are answered.)',
  zh:
    '现在是夜间时段(00:00~08:00 韩国时间),仅可自动回复。\n' +
    '如有紧急事宜,请使用1楼前台电话拨打 010-5747-1294。\n' +
    '(仅接听前台电话。个人手机来电不接听。)',
  ja:
    '現在夜間(00:00〜08:00 KST)のため、自動応答のみ対応可能です。\n' +
    '緊急のご用件は、1階フロントの電話から 010-5747-1294 におかけください。\n' +
    '(フロントからのお電話のみ対応いたします。)',
  ru:
    'Ночное время (00:00–08:00 KST) — только автоответ.\n' +
    'По срочным вопросам звоните на 010-5747-1294 с телефона стойки регистрации (1 этаж).\n' +
    '(Отвечаем только на звонки со стойки регистрации.)',
  es:
    'Horario nocturno (00:00–08:00 KST) — solo respuesta automática.\n' +
    'Para asuntos urgentes, llame al 010-5747-1294 desde el teléfono de recepción (planta 1).\n' +
    '(Solo se atienden llamadas desde recepción.)',
};

function getNightMessage(lang) {
  return NIGHT_MESSAGES[lang] || NIGHT_MESSAGES.ko;
}

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
  socket.on('guest:send_message', async ({ roomId, content, lang }) => {
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
          const nightMsg = getNightMessage(lang);
          await supabase.from('messages').insert({
            room_id: roomId,
            sender_type: 'auto',
            content: nightMsg,
          });
          socket.emit('auto:response', { content: nightMsg, confidence: 0 });
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
