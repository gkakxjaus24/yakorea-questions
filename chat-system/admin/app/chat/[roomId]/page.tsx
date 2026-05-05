'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';

interface Message {
  id?: string;
  sender_type: 'guest' | 'manager' | 'auto' | 'system';
  content: string;
  content_translated?: string | null;
  original_lang?: string | null;
  created_at?: string;
}

const SENDER_STYLE: Record<string, string> = {
  guest:   'self-start bg-gray-100 text-gray-800',
  auto:    'self-start bg-blue-50 text-blue-800 italic',
  manager: 'self-end bg-blue-600 text-white',
  system:  'self-center bg-yellow-50 text-yellow-700 text-xs px-3 py-1 rounded-full',
};

function playBeep(freq: number, times: number) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  } catch {}
}

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { socketRef, connected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [roomLabel, setRoomLabel] = useState('');
  const [guestName, setGuestName] = useState('');
  const [source, setSource] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Effect 1: 방 입장 + roomLabel 로드
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return;
    socket.emit('manager:join_room', { roomId });
  }, [connected, roomId, socketRef]);

  useEffect(() => {
    const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${SERVER_URL}/api/chat/rooms`)
      .then(r => r.json())
      .then((rooms: { id: string; room_label?: string; guest_name?: string }[]) => {
        const found = rooms.find(r => r.id === roomId);
        if (found?.room_label) setRoomLabel(found.room_label);
        if (found?.guest_name) setGuestName(found.guest_name);
        if ((found as any)?.source) setSource((found as any).source);
      })
      .catch(() => {});
  }, [roomId]);

  // Effect 2: 리스너 등록
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    const handleHistory = ({ messages: hist }: { messages: Message[] }) => {
      setMessages(hist);
    };
    const handleGuestMsg = ({ content, translated, originalLang, timestamp, roomLabel: lbl, guestName: nm }: { content: string; translated?: string | null; originalLang?: string | null; timestamp: string; roomLabel?: string; guestName?: string }) => {
      setMessages((prev) => [...prev, {
        sender_type: 'guest',
        content,
        content_translated: translated || null,
        original_lang: originalLang || null,
        created_at: timestamp,
      }]);
      if (lbl) setRoomLabel(lbl);
      if (nm) setGuestName(nm);
      if (document.visibilityState !== 'visible') playBeep(440, 1);
    };
    const handleClosed = ({ by }: { by: string }) => {
      setIsClosed(true);
      const label =
        by === 'guest' ? '손님이 대화를 종료했습니다.' :
        by === 'idle_timeout' ? '장시간 활동이 없어 자동 종료되었습니다.' :
        '대화가 종료되었습니다.';
      setMessages((prev) => [...prev, { sender_type: 'system', content: label }]);
      setTimeout(() => router.push('/'), 2000);
    };

    socket.on('room:history', handleHistory);
    socket.on('guest:message', handleGuestMsg);
    socket.on('room:closed', handleClosed);

    return () => {
      socket.off('room:history', handleHistory);
      socket.off('guest:message', handleGuestMsg);
      socket.off('room:closed', handleClosed);
    };
  }, [connected, socketRef, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendReply() {
    const content = input.trim();
    if (!content || !socketRef.current || isClosed) return;
    socketRef.current.emit('manager:send_reply', { roomId, content });
    setMessages((prev) => [...prev, { sender_type: 'manager', content }]);
    setInput('');
  }

  function closeRoom() {
    if (!socketRef.current || isClosed) return;
    if (!confirm('이 대화를 종료하시겠습니까?')) return;
    socketRef.current.emit('manager:close_room', { roomId });
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-800 text-xl">←</button>
        <div>
          <h2 className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
            채팅방
            {source === 'kiosk' ? (
              <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded font-medium">
                🖥️ 키오스크
              </span>
            ) : source === 'qr' ? (
              <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded font-medium">
                📱 QR
              </span>
            ) : null}
            {roomLabel === 'PRE_CHECKIN' ? (
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                체크인 전
              </span>
            ) : roomLabel ? (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {roomLabel}호
              </span>
            ) : null}
            {guestName && (
              <span className="text-sm font-semibold text-gray-700">{guestName}</span>
            )}
          </h2>
          <p className="text-xs text-gray-400">{roomId}</p>
        </div>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {connected ? '● 연결됨' : '○ 끊김'}
        </span>
        <button
          onClick={closeRoom}
          disabled={isClosed}
          className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          대화 종료
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">메시지가 없습니다.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col max-w-[75%] ${msg.sender_type === 'manager' ? 'self-end items-end' : 'self-start items-start'}`}>
            <span className="text-xs text-gray-400 mb-1">
              {msg.sender_type === 'guest' ? '손님' : msg.sender_type === 'manager' ? '매니저' : msg.sender_type === 'auto' ? '자동응답' : '시스템'}
              {msg.original_lang && (
                <span className="ml-1 text-gray-300">· {msg.original_lang.toUpperCase()}</span>
              )}
            </span>
            <p className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${SENDER_STYLE[msg.sender_type]}`}>
              {msg.content}
            </p>
            {msg.content_translated && (
              <p className="mt-1 px-4 py-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-2xl leading-relaxed">
                <span className="font-semibold text-gray-400">EN ›</span> {msg.content_translated}
              </p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t border-gray-200 px-4 py-3 flex gap-3">
        <input
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder={isClosed ? '대화가 종료되었습니다' : '답장을 입력하세요...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
          disabled={isClosed}
        />
        <button
          onClick={sendReply}
          disabled={isClosed}
          className="bg-blue-600 text-white rounded-full px-5 py-2 text-sm font-medium hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          전송
        </button>
      </div>
    </main>
  );
}
