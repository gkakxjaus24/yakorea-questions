'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';

interface Room {
  id: string;
  guest_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const UNREAD_KEY = 'yakorea_unread_rooms';

const STATUS_LABEL: Record<string, string> = {
  auto: '자동응답 중',
  waiting: '연결 대기',
  active: '상담 중',
  closed: '종료',
};

const STATUS_COLOR: Record<string, string> = {
  auto: 'bg-blue-100 text-blue-700',
  waiting: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

function sortByRecent(rooms: Room[]) {
  return [...rooms].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export default function AdminPage() {
  const { socketRef, connected } = useSocket();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(UNREAD_KEY);
      if (saved) setUnread(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(UNREAD_KEY, JSON.stringify(unread));
    } catch {}
  }, [unread]);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/chat/rooms`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRooms(sortByRecent(data)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onNewRequest = (data: { roomId: string; guestId: string }) => {
      setRooms((prev) => {
        if (prev.find((r) => r.id === data.roomId)) return prev;
        const now = new Date().toISOString();
        return sortByRecent([
          {
            id: data.roomId,
            guest_id: data.guestId,
            status: 'auto',
            created_at: now,
            updated_at: now,
          },
          ...prev,
        ]);
      });
    };

    const onActivity = (data: { roomId: string; guestId: string; timestamp: string }) => {
      setRooms((prev) => {
        const exists = prev.find((r) => r.id === data.roomId);
        if (exists) {
          return sortByRecent(
            prev.map((r) =>
              r.id === data.roomId ? { ...r, updated_at: data.timestamp } : r
            )
          );
        }
        return sortByRecent([
          {
            id: data.roomId,
            guest_id: data.guestId,
            status: 'auto',
            created_at: data.timestamp,
            updated_at: data.timestamp,
          },
          ...prev,
        ]);
      });
      setUnread((prev) => ({ ...prev, [data.roomId]: (prev[data.roomId] || 0) + 1 }));
    };

    socket.on('room:new_request', onNewRequest);
    socket.on('room:activity', onActivity);
    return () => {
      socket.off('room:new_request', onNewRequest);
      socket.off('room:activity', onActivity);
    };
  }, [socketRef, connected]);

  const clearUnread = (roomId: string) => {
    setUnread((prev) => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  };

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = totalUnread > 0 ? `(${totalUnread}) 야코리아 채팅 관리` : '야코리아 채팅 관리';
  }, [totalUnread]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            야코리아 채팅 관리
            {totalUnread > 0 && (
              <span className="ml-3 text-sm bg-red-500 text-white px-2 py-0.5 rounded-full">
                새 메시지 {totalUnread}
              </span>
            )}
          </h1>
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {connected ? '● 연결됨' : '○ 연결 끊김'}
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">💬</p>
            <p>대화 요청이 없습니다.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rooms.map((room) => {
              const count = unread[room.id] || 0;
              const hasUnread = count > 0;
              return (
                <li key={room.id}>
                  <Link
                    href={`/chat/${room.id}`}
                    onClick={() => clearUnread(room.id)}
                    className={`block bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition ${
                      hasUnread ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {hasUnread && (
                          <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                        <div>
                          <p className={`font-medium ${hasUnread ? 'text-gray-900' : 'text-gray-800'}`}>
                            손님 {room.guest_id.slice(0, 12)}…
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(room.updated_at).toLocaleString('ko-KR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasUnread && (
                          <span className="text-xs px-2 py-1 rounded-full font-bold bg-red-500 text-white">
                            새 메시지 {count}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[room.status] || STATUS_COLOR.closed}`}>
                          {STATUS_LABEL[room.status] || room.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
