// ============================================================
// AdminLayout — 공통 사이드바 레이아웃 컴포넌트
// ============================================================
// 모든 관리자 페이지를 감싸는 레이아웃입니다.
// 좌측 사이드바(네비게이션)와 우측 콘텐츠 영역으로 구성됩니다.
//
// 사용법:
//   <AdminLayout>
//     <div>페이지 내용</div>
//   </AdminLayout>
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getMe } from '@/lib/api';
import { joinManagerChannel, getSocket } from '@/lib/socket';

// 사이드바 네비게이션 메뉴 정의
const NAV_ITEMS = [
    { href: '/chats',    icon: '💬', label: '대화 관리' },
    { href: '/faq',      icon: '📋', label: 'FAQ 관리' },
    { href: '/settings', icon: '⚙️', label: '운영 설정' }
];

export default function AdminLayout({ children }) {
    const router   = useRouter();
    const pathname = usePathname();

    // 로그인된 관리자 정보
    const [manager, setManager] = useState(null);
    // 매니저 연결 대기 중인 방 수 (사이드바 알림 배지용)
    const [waitingCount, setWaitingCount] = useState(0);

    // ========== 로그인 상태 확인 ==========
    useEffect(() => {
        const token = localStorage.getItem('yakorea_admin_token');
        if (!token) {
            // 토큰 없으면 로그인 페이지로 이동
            router.replace('/login');
            return;
        }

        // 토큰 유효성 검사 (서버 확인)
        getMe()
            .then(data => setManager(data.manager))
            .catch(() => {
                // 토큰 만료 또는 유효하지 않음
                localStorage.removeItem('yakorea_admin_token');
                router.replace('/login');
            });
    }, [router]);

    // ========== Socket.IO 매니저 채널 조인 ==========
    // 관리자 페이지 어느 곳에 있든 실시간 알림을 받습니다.
    useEffect(() => {
        if (!manager) return;

        joinManagerChannel();
        const socket = getSocket();

        // 매니저 대기 중인 방 알림 수신
        const onRoomUpdate = ({ status }) => {
            if (status === 'waiting_manager') {
                setWaitingCount(c => c + 1);
            }
        };

        socket.on('manager:room_update', onRoomUpdate);
        return () => { socket.off('manager:room_update', onRoomUpdate); };
    }, [manager]);

    // ========== 로그아웃 ==========
    const handleLogout = () => {
        localStorage.removeItem('yakorea_admin_token');
        router.push('/login');
    };

    // 로그인 확인 전 빈 화면 (깜빡임 방지)
    if (!manager) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f0f2fb' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            {/* ---- 사이드바 ---- */}
            <aside className="sidebar">
                {/* 로고 */}
                <div className="sidebar-logo">
                    <h1>🏨 야코리아</h1>
                    <span>채팅 관리자 V2</span>
                </div>

                {/* 네비게이션 */}
                <nav className="sidebar-nav">
                    {NAV_ITEMS.map(item => (
                        <a
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                router.push(item.href);
                            }}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>
                                {item.label}
                                {/* 대화 관리에 대기 중인 방 수 배지 표시 */}
                                {item.href === '/chats' && waitingCount > 0 && (
                                    <span style={{
                                        marginLeft: 6, background: '#ff4757', color: 'white',
                                        fontSize: 10, padding: '1px 6px', borderRadius: 10,
                                        fontWeight: 700
                                    }}>
                                        {waitingCount}
                                    </span>
                                )}
                            </span>
                        </a>
                    ))}
                </nav>

                {/* 하단 계정 정보 */}
                <div className="sidebar-footer">
                    <div>{manager.email}</div>
                    <button className="logout-btn" onClick={handleLogout}>
                        🚪 로그아웃
                    </button>
                </div>
            </aside>

            {/* ---- 메인 콘텐츠 ---- */}
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
