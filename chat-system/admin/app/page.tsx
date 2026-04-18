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

export default function AdminPage() {
  const { socketRef, connected } = useSocket();
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/chat/rooms`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRooms(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handler = (data: { roomId: string; guestId: string }) => {
      setRooms((prev) => {
        if (prev.find((r) => r.id === data.roomId)) return prev;
        return [{
          id: data.roomId,
          guest_id: data.guestId,
          status: 'auto',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, ...prev];
      });
    };

    socket.on('room:new_request', handler);
    return () => { socket.off('room:new_request', handler); };
  }, [socketRef, connected]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">야코리아 채팅 관리</h1>
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
            {rooms.map((room) => (
              <li key={room.id}>
                <Link href={`/chat/${room.id}`}
                  className="block bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-blue-200 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">손님 {room.guest_id.slice(0, 12)}…</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(room.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[room.status] || STATUS_COLOR.closed}`}>
                      {STATUS_LABEL[room.status] || room.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
