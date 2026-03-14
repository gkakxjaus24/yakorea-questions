// ============================================================
// 로그인 페이지 (/login)
// ============================================================
// 관리자가 이메일/비밀번호로 로그인하는 페이지입니다.
// 로그인 성공 시 JWT 토큰을 localStorage에 저장하고 /chats로 이동합니다.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
    const router = useRouter();

    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);

    // 이미 로그인 상태면 /chats로 이동
    useEffect(() => {
        const token = localStorage.getItem('yakorea_admin_token');
        if (token) router.replace('/chats');
    }, [router]);

    // 로그인 폼 제출 처리
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password.trim()) {
            setError('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            const data = await login(email, password);
            // 토큰 저장 후 대화 관리 페이지로 이동
            localStorage.setItem('yakorea_admin_token', data.token);
            router.replace('/chats');
        } catch (err) {
            setError(err.message || '로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
        }}>
            <div style={{
                width: '100%', maxWidth: 400,
                background: 'white', borderRadius: 16,
                padding: '40px 36px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
                {/* 로고 */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🏨</div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
                        야코리아 채팅 관리자
                    </h1>
                    <p style={{ fontSize: 13, color: '#7f8c8d' }}>관리자 계정으로 로그인하세요</p>
                </div>

                {/* 에러 메시지 */}
                {error && (
                    <div style={{
                        background: '#fdecea', border: '1px solid #f5c6cb',
                        borderRadius: 8, padding: '10px 14px',
                        color: '#c0392b', fontSize: 13, marginBottom: 16
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* 로그인 폼 */}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">이메일</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="manager@yakorea.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">비밀번호</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="비밀번호 입력"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        style={{ marginTop: 8, justifyContent: 'center', padding: '12px' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <><span className="spinner" style={{ width: 16, height: 16 }}></span> 로그인 중...</>
                        ) : '로그인'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', fontSize: 11, color: '#bdc3c7', marginTop: 24 }}>
                    야코리아 채팅 시스템 V2
                </p>
            </div>
        </div>
    );
}
