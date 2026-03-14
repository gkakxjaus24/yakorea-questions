// ============================================================
// 루트 페이지 (/)
// ============================================================
// 로그인 여부에 따라 /chats 또는 /login으로 리다이렉트합니다.
// ============================================================

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('yakorea_admin_token');
        router.replace(token ? '/chats' : '/login');
    }, [router]);

    // 리다이렉트 중 빈 화면
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: '#f0f2fb'
        }}>
            <div className="spinner"></div>
        </div>
    );
}
