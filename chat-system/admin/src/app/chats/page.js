// ============================================================
// 대화방 목록 페이지 (/chats)
// ============================================================
// 전체 대화방 목록을 표시합니다.
// Socket.IO로 실시간 업데이트를 받아 새 메시지나 상태 변경을 즉시 반영합니다.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { getRooms } from '@/lib/api';
import { getSocket } from '@/lib/socket';

// 상태 필터 탭 정의
const FILTERS = [
    { key: 'all',            label: '전체' },
    { key: 'waiting_manager', label: '⏳ 매니저 대기' },
    { key: 'active',          label: '활성' },
    { key: 'closed',          label: '종료' }
];

// 언어 국기 아이콘
const LANG_FLAG = { ko: '🇰🇷', en: '🇺🇸', zh: '🇨🇳', ja: '🇯🇵' };

// 상태 배지 스타일
const STATUS_BADGE = {
    active:          { cls: 'badge-active',  text: '활성' },
    waiting_manager: { cls: 'badge-waiting', text: '⏳ 매니저 대기' },
    closed:          { cls: 'badge-closed',  text: '종료' }
};

export default function ChatsPage() {
    const router = useRouter();

    const [rooms,   setRooms]   = useState([]);
    const [filter,  setFilter]  = useState('all');
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    // ===== 대화방 목록 조회 =====
    const fetchRooms = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getRooms(filter);
            setRooms(data.rooms || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { fetchRooms(); }, [fetchRooms]);

    // ===== Socket.IO 실시간 업데이트 =====
    // 새 메시지 또는 방 상태 변경 시 목록을 자동으로 갱신합니다.
    useEffect(() => {
        const socket = getSocket();

        // 새 메시지가 오면 해당 방을 목록 맨 위로 올리고 미읽음 표시
        const onNewMsg = ({ roomId }) => {
            setRooms(prev => {
                const idx = prev.findIndex(r => r.id === roomId);
                if (idx < 0) {
                    // 목록에 없는 새 방이면 서버에서 다시 조회
                    fetchRooms();
                    return prev;
                }
                const updated = { ...prev[idx], has_unread: true, last_message_at: new Date().toISOString() };
                const next = [...prev];
                next.splice(idx, 1);
                return [updated, ...next];
            });
        };

        // 방 상태 변경 (예: waiting_manager) 시 해당 방의 상태를 업데이트
        const onRoomUpdate = ({ roomId, status }) => {
            setRooms(prev =>
                prev.map(r => r.id === roomId ? { ...r, status } : r)
            );
        };

        socket.on('manager:new_message', onNewMsg);
        socket.on('manager:room_update', onRoomUpdate);

        return () => {
            socket.off('manager:new_message', onNewMsg);
            socket.off('manager:room_update', onRoomUpdate);
        };
    }, [fetchRooms]);

    // ===== 유틸 함수 =====
    const timeAgo = (dateStr) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)  return '방금';
        if (mins < 60) return `${mins}분 전`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `${hrs}시간 전`;
        return `${Math.floor(hrs / 24)}일 전`;
    };

    const badgeInfo = (status) => STATUS_BADGE[status] || { cls: '', text: status };

    // ===== waiting_manager 방 수 계산 (헤더 알림용) =====
    const waitingCount = rooms.filter(r => r.status === 'waiting_manager').length;

    return (
        <AdminLayout>
            {/* 페이지 헤더 */}
            <div className="card-header">
                <h2>
                    💬 대화 관리
                    {waitingCount > 0 && (
                        <span style={{
                            marginLeft: 8, background: '#ff4757', color: 'white',
                            fontSize: 12, padding: '2px 9px', borderRadius: 12, fontWeight: 700
                        }}>
                            {waitingCount}개 대기 중
                        </span>
                    )}
                </h2>
                <button className="btn btn-secondary btn-sm" onClick={fetchRooms}>
                    🔄 새로고침
                </button>
            </div>

            {/* 상태 필터 탭 */}
            <div className="filter-bar">
                {FILTERS.map(f => (
                    <button
                        key={f.key}
                        className={`filter-btn ${filter === f.key ? 'active' : ''}`}
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                        {/* waiting_manager 탭에 카운트 표시 */}
                        {f.key === 'waiting_manager' && waitingCount > 0 && (
                            <span style={{
                                marginLeft: 5, background: '#ff4757', color: 'white',
                                fontSize: 10, padding: '0 5px', borderRadius: 8, fontWeight: 700
                            }}>
                                {waitingCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* 대화방 목록 */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div> 불러오는 중...
                    </div>
                ) : error ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--error)' }}>
                        <p style={{ marginBottom: 8 }}>⚠️ {error}</p>
                        <button className="btn btn-secondary btn-sm" onClick={fetchRooms}>다시 시도</button>
                    </div>
                ) : rooms.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: 32, marginBottom: 8 }}>💬</p>
                        <p>대화 내역이 없습니다.</p>
                    </div>
                ) : (
                    <div className="room-list">
                        {rooms.map(room => {
                            const badge = badgeInfo(room.status);
                            return (
                                <div
                                    key={room.id}
                                    className="room-item"
                                    onClick={() => router.push(`/chats/${room.id}`)}
                                >
                                    {/* 미읽음 파란 점 */}
                                    {room.has_unread && <div className="unread-dot"></div>}

                                    {/* 언어 국기 */}
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>
                                        {LANG_FLAG[room.language] || '🌐'}
                                    </span>

                                    {/* 방 정보 */}
                                    <div className="room-info">
                                        <div className="room-guest">
                                            손님 {room.guest_session_id?.slice(-8)}
                                            {room.is_manager_connected && (
                                                <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--success)' }}>
                                                    ● 매니저 연결됨
                                                </span>
                                            )}
                                        </div>
                                        <div className="room-preview">
                                            마지막 활동: {timeAgo(room.last_message_at || room.created_at)}
                                        </div>
                                    </div>

                                    {/* 상태 배지 + 생성 시간 */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                        <span className={`badge ${badge.cls}`}>{badge.text}</span>
                                        <span className="room-time">{timeAgo(room.created_at)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
