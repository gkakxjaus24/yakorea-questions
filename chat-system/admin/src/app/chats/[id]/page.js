// ============================================================
// 대화방 상세 페이지 (/chats/[id])
// ============================================================
// 손님과의 대화 내역을 표시하고, 매니저가 직접 답장을 보내는 페이지입니다.
//
// 주요 기능:
//   - 이전 메시지 내역 불러오기
//   - Socket.IO로 실시간 메시지 수신
//   - 매니저 답장 전송 (socket.emit)
//   - 대화방 상태 변경 (종료 등)
// ============================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { getMessages, updateRoom } from '@/lib/api';
import { getSocket, joinRoom, sendReply } from '@/lib/socket';

// 언어 국기
const LANG_FLAG = { ko: '🇰🇷', en: '🇺🇸', zh: '🇨🇳', ja: '🇯🇵' };

export default function ChatDetailPage() {
    const router    = useRouter();
    const { id }    = useParams();  // URL에서 대화방 ID 추출

    const [messages,   setMessages]   = useState([]);
    const [inputText,  setInputText]  = useState('');
    const [loading,    setLoading]    = useState(true);
    const [sending,    setSending]    = useState(false);
    const [roomInfo,   setRoomInfo]   = useState(null);  // 대화방 기본 정보

    // 메시지 목록 하단으로 자동 스크롤하기 위한 ref
    const bottomRef = useRef(null);
    const inputRef  = useRef(null);

    // ===== 이전 메시지 불러오기 =====
    const fetchMessages = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getMessages(id);
            setMessages(data.messages || []);
        } catch (err) {
            console.error('메시지 조회 에러:', err.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchMessages(); }, [fetchMessages]);

    // ===== Socket.IO 연결 및 실시간 메시지 수신 =====
    useEffect(() => {
        if (!id) return;

        // 이 대화방의 소켓 룸에 조인 (미읽음 처리도 서버에서 자동으로 처리)
        joinRoom(id);

        const socket = getSocket();

        // 새 메시지 수신 시 목록에 추가
        const onNewMsg = ({ message }) => {
            setMessages(prev => {
                // 중복 메시지 방지 (소켓으로 이미 추가된 것)
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
        };

        socket.on('new_message', onNewMsg);
        return () => { socket.off('new_message', onNewMsg); };
    }, [id]);

    // ===== 새 메시지 오면 자동 스크롤 =====
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ===== 답장 전송 =====
    const handleSend = () => {
        const content = inputText.trim();
        if (!content || sending) return;

        setSending(true);
        sendReply(id, content);  // Socket.IO로 전송
        setInputText('');
        inputRef.current?.focus();
        setSending(false);
    };

    // Enter 키로 전송 (Shift+Enter = 줄바꿈)
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ===== 대화방 종료 =====
    const handleClose = async () => {
        if (!confirm('대화방을 종료하시겠습니까? 손님에게 더 이상 답장을 보낼 수 없습니다.')) return;
        try {
            await updateRoom(id, { status: 'closed' });
            router.push('/chats');
        } catch (err) {
            alert('종료 처리에 실패했습니다.');
        }
    };

    // ===== 유틸 =====
    const formatTime = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    };

    // 날짜 구분선 표시를 위해 이전 메시지와 날짜가 다른지 확인
    const isDifferentDay = (a, b) => {
        if (!a) return true;
        return new Date(a.created_at).toDateString() !== new Date(b.created_at).toDateString();
    };

    // 발신자 타입별 표시 정보
    const senderInfo = (msg) => {
        if (msg.sender_type === 'guest')                         return { label: '손님',        cls: 'guest'   };
        if (msg.sender_type === 'system' && msg.is_auto_reply)   return { label: '🤖 자동응답', cls: 'system'  };
        if (msg.sender_type === 'manager')                       return { label: '👤 매니저',   cls: 'manager' };
        return { label: '시스템', cls: 'system' };
    };

    return (
        <AdminLayout>
            {/* ---- 페이지 헤더 ---- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                {/* 뒤로가기 */}
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => router.push('/chats')}
                >
                    ← 목록
                </button>

                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 700 }}>
                        대화방 상세
                        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                            #{id?.slice(-8)}
                        </span>
                    </h2>
                </div>

                {/* 대화방 종료 버튼 */}
                <button className="btn btn-danger btn-sm" onClick={handleClose}>
                    ✕ 대화 종료
                </button>
            </div>

            {/* ---- 메인 채팅 영역 ---- */}
            <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>

                {/* 메시지 목록 */}
                <div className="msg-list">
                    {loading ? (
                        <div className="loading"><div className="spinner"></div> 불러오는 중...</div>
                    ) : messages.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                            메시지가 없습니다.
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const info     = senderInfo(msg);
                            const prevMsg  = idx > 0 ? messages[idx - 1] : null;
                            const showDate = isDifferentDay(prevMsg, msg);

                            return (
                                <div key={msg.id}>
                                    {/* 날짜 구분선 */}
                                    {showDate && (
                                        <div style={{
                                            textAlign: 'center', fontSize: 11,
                                            color: 'var(--text-muted)', margin: '12px 0',
                                            display: 'flex', alignItems: 'center', gap: 8
                                        }}>
                                            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }}/>
                                            {formatDate(msg.created_at)}
                                            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }}/>
                                        </div>
                                    )}

                                    {/* 메시지 말풍선 */}
                                    <div className={`msg-wrap ${info.cls}`}>
                                        <div className="msg-sender">{info.label}</div>
                                        <div className="msg-bubble">{msg.content}</div>
                                        <div className="msg-time">{formatTime(msg.created_at)}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {/* 자동 스크롤 앵커 */}
                    <div ref={bottomRef}></div>
                </div>

                {/* ---- 답장 입력 영역 ---- */}
                <div style={{
                    borderTop: '1px solid var(--border)',
                    padding: '12px 16px',
                    background: 'white',
                    display: 'flex', gap: 10, alignItems: 'flex-end'
                }}>
                    <textarea
                        ref={inputRef}
                        className="form-textarea"
                        placeholder="손님에게 답장을 보내세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        style={{ flex: 1, minHeight: 60, maxHeight: 160, resize: 'none' }}
                        disabled={sending}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={!inputText.trim() || sending}
                        style={{ flexShrink: 0, height: 60, paddingInline: 20 }}
                    >
                        전송 ↵
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}
