// ============================================================
// Socket.IO 이벤트 핸들러 (handlers.js)
// ============================================================
// 실시간 채팅을 위한 WebSocket 이벤트 처리 모듈입니다.
//
// 담당 역할:
//   - 손님 ↔ 서버 ↔ 매니저 간 실시간 메시지 전달
//   - 자동응답 엔진 실행 (매니저 미연결 상태에서)
//   - Socket.IO room 기능으로 대화방별 메시지 격리
//
// Socket.IO Room 구조:
//   "room:{roomId}"    — 특정 대화방 (손님 + 해당 방 매니저)
//   "manager_channel"  — 모든 매니저 (알림 브로드캐스트용)
// ============================================================

const { supabaseAdmin } = require('../db/supabase');
const { processAutoReply } = require('../services/auto-reply');


/**
 * Socket.IO 이벤트 핸들러를 초기화합니다.
 * 서버 시작 시 io 인스턴스를 전달받아 이벤트를 등록합니다.
 *
 * @param {import('socket.io').Server} io - Socket.IO 서버 인스턴스
 */
function initSocketHandlers(io) {

    io.on('connection', (socket) => {
        console.log(`🔌 소켓 연결됨: ${socket.id}`);

        // ========================================================
        // 손님 전용 이벤트
        // ========================================================

        /**
         * [손님] guest:join — 손님이 채팅 위젯을 열었을 때 호출
         * 해당 대화방(room)에 소켓을 조인하여 메시지를 받을 준비를 합니다.
         *
         * 클라이언트 전송 데이터: { roomId: string, sessionId: string }
         */
        socket.on('guest:join', async ({ roomId, sessionId } = {}) => {
            if (!roomId) return;
            socket.join(`room:${roomId}`);
            socket.data = { roomId, sessionId, role: 'guest' };
            const room = io.sockets.adapter.rooms.get(`room:${roomId}`);
            console.log(`🧳 손님 입장 — 방: ${roomId}, 소켓: ${socket.id}, 방 안 소켓 수: ${room ? room.size : 0}`);
        });


        /**
         * [손님] guest:send_message — 손님이 메시지를 전송했을 때 호출
         *
         * 처리 순서:
         *   1. 메시지를 DB에 저장
         *   2. 같은 방에 있는 모두에게 실시간 전달
         *   3. 매니저 알림 채널에 새 메시지 알림
         *   4. 자동응답 엔진 실행 (매니저 미연결 상태에서만)
         *
         * 클라이언트 전송 데이터: { roomId: string, content: string }
         */
        socket.on('guest:send_message', async ({ roomId, content } = {}) => {
            // 유효성 검사: 방 ID와 내용이 모두 있어야 함
            if (!roomId || !content || content.trim() === '') return;

            const trimmedContent = content.trim();

            try {
                // 1) 손님 메시지를 DB에 저장
                const { data: message, error } = await supabaseAdmin
                    .from('messages')
                    .insert({
                        chat_room_id:  roomId,
                        sender_type:   'guest',
                        content:       trimmedContent,
                        is_auto_reply: false,
                        is_read:       false
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('[Socket] 메시지 저장 실패:', error.message);
                    socket.emit('error', { message: '메시지 전송에 실패했습니다.' });
                    return;
                }

                // 2) 대화방의 마지막 메시지 시간과 미읽음 표시 업데이트
                await supabaseAdmin
                    .from('chat_rooms')
                    .update({
                        last_message_at: new Date().toISOString(),
                        has_unread:      true,
                        updated_at:      new Date().toISOString()
                    })
                    .eq('id', roomId);

                // 3) 해당 방에 있는 모든 소켓에게 메시지 전달 (손님 본인 포함)
                io.to(`room:${roomId}`).emit('new_message', { message });

                // 4) 매니저 전용 채널에도 알림 (매니저가 대화방 목록에서 새 메시지를 인지하도록)
                io.to('manager_channel').emit('manager:new_message', { roomId, message });

                console.log(`💬 손님 메시지 — 방: ${roomId}`);

                // ===== 자동응답 엔진 실행 =====
                // 매니저가 이미 연결된 방은 자동응답을 하지 않습니다.
                // (실제 매니저가 대화 중인데 봇이 끼어들면 안 되기 때문)
                const { data: room } = await supabaseAdmin
                    .from('chat_rooms')
                    .select('is_manager_connected, language')
                    .eq('id', roomId)
                    .single();

                if (!room || room.is_manager_connected) {
                    console.log(`⏭️ 자동응답 건너뜀 — 방: ${roomId}, is_manager_connected: ${room?.is_manager_connected}`);
                    return;
                }

                const language    = room.language || 'ko';
                const autoResult  = await processAutoReply(trimmedContent, language, roomId);

                if (autoResult.type === 'auto_reply' && autoResult.message) {
                    // 자동응답 성공 → 답변 메시지 전달
                    io.to(`room:${roomId}`).emit('new_message', { message: autoResult.message });

                } else if (autoResult.type === 'suggest' && autoResult.message) {
                    // 후보 제시 → 안내 메시지 전달
                    io.to(`room:${roomId}`).emit('new_message', { message: autoResult.message });

                } else if (autoResult.type === 'no_match') {
                    // 자동응답 실패 → 매니저 연결 유도 메시지 전송
                    // auto-reply.js에서 이미 메시지를 저장했으면 그대로 사용, 아니면 새로 생성
                    let noMatchMsg = autoResult.message;

                    if (!noMatchMsg) {
                        const noMatchTexts = {
                            ko: '자동응답으로 답변하기 어려운 질문입니다. 아래 "매니저와 대화하기" 버튼을 눌러주시면 담당자가 직접 도와드립니다.',
                            en: 'I couldn\'t find an automatic answer. Please click "Talk to Manager" below for assistance.',
                            zh: '很抱歉，无法自动回答您的问题。请点击下方"联系管理人员"按钮。',
                            ja: '申し訳ありませんが、自動回答が見つかりませんでした。下の「マネージャーと話す」ボタンをお押しください。'
                        };

                        const { data: savedMsg } = await supabaseAdmin
                            .from('messages')
                            .insert({
                                chat_room_id:  roomId,
                                sender_type:   'system',
                                content:       noMatchTexts[language] ?? noMatchTexts.ko,
                                is_auto_reply: true,  // 위젯에서 "매니저와 대화하기" 버튼을 표시하기 위해 true
                                is_read:       false
                            })
                            .select()
                            .single();

                        noMatchMsg = savedMsg;
                    }

                    if (noMatchMsg) {
                        io.to(`room:${roomId}`).emit('new_message', { message: noMatchMsg });
                    }
                }

            } catch (err) {
                console.error('[Socket] guest:send_message 에러:', err.message);
                socket.emit('error', { message: '메시지 전송 중 오류가 발생했습니다.' });
            }
        });


        /**
         * [손님] guest:request_manager — 손님이 매니저 연결을 요청했을 때 호출
         *
         * 처리 순서:
         *   1. 대화방 상태를 'waiting_manager'로 변경
         *   2. 시스템 안내 메시지 저장 및 전달
         *   3. 매니저 채널에 알림
         *
         * 클라이언트 전송 데이터: { roomId: string }
         */
        socket.on('guest:request_manager', async ({ roomId } = {}) => {
            if (!roomId) return;

            try {
                // 1) 대화방 상태를 '매니저 대기 중'으로 변경
                await supabaseAdmin
                    .from('chat_rooms')
                    .update({
                        status:     'waiting_manager',
                        has_unread: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', roomId);

                // 2) 손님에게 시스템 안내 메시지 전달
                const { data: sysMsg } = await supabaseAdmin
                    .from('messages')
                    .insert({
                        chat_room_id:  roomId,
                        sender_type:   'system',
                        content:       '매니저에게 연결을 요청했습니다. 잠시만 기다려주세요.',
                        is_auto_reply: false,
                        is_read:       false
                    })
                    .select()
                    .single();

                if (sysMsg) {
                    io.to(`room:${roomId}`).emit('new_message', { message: sysMsg });
                }

                // 3) 매니저 채널에 알림 전송 (매니저가 빨리 대응하도록)
                io.to('manager_channel').emit('manager:room_update', {
                    roomId,
                    status: 'waiting_manager'
                });

                console.log(`🔔 매니저 연결 요청 — 방: ${roomId}`);

            } catch (err) {
                console.error('[Socket] guest:request_manager 에러:', err.message);
            }
        });


        /**
         * [손님] guest:close_room — 손님이 직접 대화를 종료할 때 호출
         *
         * 클라이언트 전송 데이터: { roomId: string }
         */
        socket.on('guest:close_room', async ({ roomId } = {}) => {
            if (!roomId) return;

            try {
                await supabaseAdmin
                    .from('chat_rooms')
                    .update({
                        status:               'closed',
                        is_manager_connected: false,
                        updated_at:           new Date().toISOString()
                    })
                    .eq('id', roomId);

                // 매니저 채널에 종료 알림
                io.to('manager_channel').emit('manager:room_update', { roomId, status: 'closed' });

                console.log(`🔒 손님이 대화 종료 — 방: ${roomId}`);

            } catch (err) {
                console.error('[Socket] guest:close_room 에러:', err.message);
            }
        });


        // ========================================================
        // 매니저 전용 이벤트
        // ========================================================

        /**
         * [매니저] manager:join — 관리자 페이지 접속 시 호출
         * 매니저 전용 알림 채널에 조인합니다.
         */
        socket.on('manager:join', () => {
            socket.join('manager_channel');
            socket.data = { role: 'manager' };
            console.log(`🔧 매니저 접속: ${socket.id}`);
        });


        /**
         * [매니저] manager:join_room — 매니저가 특정 대화방을 클릭했을 때 호출
         * 해당 방에 조인하고 미읽음 메시지를 모두 읽음 처리합니다.
         *
         * 클라이언트 전송 데이터: { roomId: string }
         */
        socket.on('manager:join_room', async ({ roomId } = {}) => {
            if (!roomId) return;

            socket.join(`room:${roomId}`);
            console.log(`🔧 매니저 대화방 입장 — 방: ${roomId}`);

            // 모든 미읽음 메시지를 읽음으로 처리
            await supabaseAdmin
                .from('chat_rooms')
                .update({ has_unread: false, updated_at: new Date().toISOString() })
                .eq('id', roomId);

            await supabaseAdmin
                .from('messages')
                .update({ is_read: true })
                .eq('chat_room_id', roomId)
                .eq('is_read', false);
        });


        /**
         * [매니저] manager:send_reply — 매니저가 손님에게 답장을 보낼 때 호출
         *
         * 처리 순서:
         *   1. 매니저 메시지를 DB에 저장
         *   2. 대화방 상태를 'active' & is_manager_connected=true로 업데이트
         *   3. 해당 방에 있는 손님에게 실시간 전달
         *
         * 클라이언트 전송 데이터: { roomId: string, content: string }
         */
        socket.on('manager:send_reply', async ({ roomId, content } = {}) => {
            if (!roomId || !content || content.trim() === '') return;

            try {
                // 1) 매니저 메시지 저장 (매니저 메시지는 처음부터 읽음 처리)
                const { data: message, error } = await supabaseAdmin
                    .from('messages')
                    .insert({
                        chat_room_id:  roomId,
                        sender_type:   'manager',
                        content:       content.trim(),
                        is_auto_reply: false,
                        is_read:       true   // 매니저 본인이 보낸 메시지는 이미 읽음
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('[Socket] 매니저 답장 저장 실패:', error.message);
                    socket.emit('error', { message: '답장 전송에 실패했습니다.' });
                    return;
                }

                // 2) 대화방 상태 업데이트: 매니저 연결됨으로 표시
                await supabaseAdmin
                    .from('chat_rooms')
                    .update({
                        status:              'active',
                        is_manager_connected: true,
                        last_message_at:     new Date().toISOString(),
                        updated_at:          new Date().toISOString()
                    })
                    .eq('id', roomId);

                // 3) 해당 방의 손님에게 답장 전달
                const room = io.sockets.adapter.rooms.get(`room:${roomId}`);
                const socketsInRoom = room ? [...room] : [];
                console.log(`📩 매니저 답장 — 방: ${roomId}, 방 안 소켓 수: ${socketsInRoom.length}, 소켓 ID 목록: [${socketsInRoom.join(', ')}]`);

                io.to(`room:${roomId}`).emit('new_message', { message });

            } catch (err) {
                console.error('[Socket] manager:send_reply 에러:', err.message);
                socket.emit('error', { message: '답장 전송 중 오류가 발생했습니다.' });
            }
        });


        /**
         * [매니저] manager:close_room — 매니저가 대화방을 종료할 때 호출
         *
         * 처리 순서:
         *   1. 대화방 상태를 'closed'로 변경, is_manager_connected 리셋
         *   2. 종료 안내 메시지를 저장 및 전달
         *   3. 손님 위젯에 room_closed 이벤트 전달
         *
         * 클라이언트 전송 데이터: { roomId: string }
         */
        socket.on('manager:close_room', async ({ roomId } = {}) => {
            if (!roomId) return;

            try {
                // 1) 대화방 상태 변경
                await supabaseAdmin
                    .from('chat_rooms')
                    .update({
                        status:               'closed',
                        is_manager_connected: false,
                        updated_at:           new Date().toISOString()
                    })
                    .eq('id', roomId);

                // 2) 종료 안내 메시지 저장
                const { data: closeMsg } = await supabaseAdmin
                    .from('messages')
                    .insert({
                        chat_room_id:  roomId,
                        sender_type:   'system',
                        content:       '대화가 종료되었습니다. 추가 문의가 있으시면 새로 메시지를 보내주세요.',
                        is_auto_reply: false,
                        is_read:       false
                    })
                    .select()
                    .single();

                // 3) 해당 방에 종료 메시지 + 종료 이벤트 전달
                if (closeMsg) {
                    io.to(`room:${roomId}`).emit('new_message', { message: closeMsg });
                }
                io.to(`room:${roomId}`).emit('room_closed', { roomId });

                // 매니저 채널에도 알림
                io.to('manager_channel').emit('manager:room_update', { roomId, status: 'closed' });

                console.log(`🔒 대화방 종료 — 방: ${roomId}`);

            } catch (err) {
                console.error('[Socket] manager:close_room 에러:', err.message);
                socket.emit('error', { message: '대화 종료에 실패했습니다.' });
            }
        });


        // ========================================================
        // 연결 해제 처리
        // ========================================================
        socket.on('disconnect', (reason) => {
            const role   = socket.data?.role || 'unknown';
            const roomId = socket.data?.roomId;
            console.log(`🔌 소켓 연결 해제: ${socket.id} (역할: ${role}, 방: ${roomId || '없음'}, 이유: ${reason})`);
        });
    });
}


module.exports = initSocketHandlers;
