const supabase = require('../services/supabase');
const faqMatcher = require('../services/faqMatcher');
const telegram = require('../services/telegram');
const llmFallback = require('../services/llmFallback');
const translateService = require('../services/translateService');

// 매니저(중국인)가 그대로 읽을 수 있는 언어 — 번역 필요 없음
const MANAGER_LANGS = ['ko', 'en', 'zh'];

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

// roomId → roomLabel / guestName / source 인메모리 맵
const roomLabelMap = new Map();
const guestNameMap = new Map();
const sourceMap = new Map(); // 'kiosk' | 'qr'

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
  socket.on('guest:join', async ({ roomId, guestId, roomLabel, guestName, source }) => {
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
      if (source) sourceMap.set(room.id, source);

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
      const source = sourceMap.get(roomId) || '';

      // --- Forward 번역 (손님 → 매니저) ---
      // 매니저가 못 읽는 언어로 들어오면 영어로 번역해서 같이 전달
      let translated = null;
      let originalLang = null;
      if (lang && !MANAGER_LANGS.includes(lang) && (await translateService.isEnabled())) {
        const r = await translateService.translate({
          text: content,
          sourceLang: lang,
          targetLang: 'en',
          roomId,
          direction: 'forward',
        });
        if (r.ok) {
          translated = r.translated;
          originalLang = lang;
          // DB에도 번역문/원본 언어 기록 (히스토리 재로드 시 매니저가 다시 볼 수 있게)
          await supabase
            .from('messages')
            .update({ content_translated: translated, original_lang: originalLang })
            .eq('id', msg.id);
        }
      }

      // 같은 방의 매니저에게 전달 (번역문 있으면 같이)
      socket.to(roomId).emit('guest:message', {
        content: msg.content,
        translated,
        originalLang,
        timestamp: msg.created_at,
      });

      // 방 updated_at + guest_lang 갱신 + 현재 status 동시 조회
      const roomUpdate = { updated_at: new Date().toISOString() };
      if (lang) roomUpdate.guest_lang = lang;
      const { data: roomAfter } = await supabase
        .from('chat_rooms')
        .update(roomUpdate)
        .eq('id', roomId)
        .select('status')
        .maybeSingle();

      // 관리자 목록 페이지 전체에 알림 (번역문이 있으면 알림에도 영어 표시)
      io.emit('room:activity', {
        roomId,
        guestId: socket.guestId || socket.id,
        content: translated || msg.content,
        timestamp: msg.created_at,
        roomLabel, guestName, source,
      });

      // 유휴 타임아웃 리셋
      scheduleIdleClose(io, roomId);

      // 매니저가 이미 연결된 방(status='active')에서는 FAQ 자동응답 / LLM /
      // escalate 모두 건너뜀 — 직원이 직접 답장하도록.
      if (roomAfter?.status === 'active') {
        console.log(`[Guest] active room ${roomId} — 자동응답 생략 (직원 응대 중)`);
        return;
      }

      // FAQ 자동응답 (게스트가 선택한 언어로 매칭)
      const result = await faqMatcher.match(content, lang || 'ko');
      if (result.type === 'auto') {
        await supabase.from('messages').insert({
          room_id: roomId,
          sender_type: 'auto',
          content: result.faq.answer,
        });
        socket.emit('auto:response', {
          content: result.faq.answer,
          confidence: result.confidence,
          requiresHandoff: !!result.requiresHandoff,
        });
      } else if (result.type === 'candidates') {
        socket.emit('auto:candidates', { candidates: result.candidates });
      } else {
        // --- LLM 폴백 시도 (플래그 ON일 때만) ---
        // Jaccard가 못 잡은 질문을 Claude Haiku 4.5가 DB 답변만 보고 시도.
        // 답을 모르면 NO_MATCH → 기존 야간/escalate 흐름으로 fall-through.
        // 단, 명시적 매니저 호출(handoff=true)은 LLM도 건너뛰고 즉시 매니저 연결.
        let llmHandled = false;
        if (!result.handoff && (await llmFallback.isEnabled())) {
          socket.emit('auto:typing', { on: true });
          const r = await llmFallback.answer({
            question: content,
            lang: lang || 'ko',
            roomId,
          });
          socket.emit('auto:typing', { on: false });

          if (r.ok) {
            await supabase.from('messages').insert({
              room_id: roomId,
              sender_type: 'auto',
              content: r.answer,
            });
            socket.emit('auto:response', {
              content: r.answer,
              confidence: 0.6,
              source: 'llm',
            });
            llmHandled = true;
            console.log(`[LLM] room ${roomId} answered by Haiku (${r.latencyMs}ms)`);
          } else {
            console.log(`[LLM] room ${roomId} skipped/failed: ${r.reason}`);
          }
        }

        if (!llmHandled) {
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
      llmFallback.clearRoomCounter(roomId);
      translateService.clearRoomCounter(roomId);
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
module.exports.sourceMap = sourceMap;
