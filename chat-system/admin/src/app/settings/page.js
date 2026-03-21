// ============================================================
// 운영 설정 페이지 (/settings)
// ============================================================
// 채팅 시스템 운영에 필요한 설정값을 편집합니다.
//
// 주요 기능:
//   - 카테고리별 설정 조회 (운영시간, 보안, 자동응답 임계값 등)
//   - 설정값 인라인 편집 및 저장
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { getSettings, updateSetting } from '@/lib/api';

// 카테고리 탭 정의
const CATEGORIES = [
    { key: 'all',       label: '전체' },
    { key: 'operation', label: '⏰ 운영시간' },
    { key: 'security',  label: '🔒 보안정보' },
    { key: 'threshold', label: '🤖 자동응답' },
    { key: 'general',   label: '⚙️ 일반' },
];

// 설정 키별 표시 정보 (한글 레이블 + 설명)
const KEY_INFO = {
    check_in_time:        { label: '체크인 시간',       desc: '답변 템플릿에서 {{check_in_time}} 으로 사용' },
    check_out_time:       { label: '체크아웃 시간',     desc: '답변 템플릿에서 {{check_out_time}} 으로 사용' },
    wifi_password:        { label: 'Wi-Fi 비밀번호',    desc: '답변 템플릿에서 {{wifi_password}} 으로 사용' },
    locker_password:      { label: '락커 비밀번호',     desc: '답변 템플릿에서 {{locker_password}} 으로 사용' },
    auto_reply_high_threshold: { label: '자동응답 확정 임계값', desc: '이 점수 이상이면 즉시 자동응답 (0~1)' },
    auto_reply_low_threshold:  { label: '자동응답 후보 임계값', desc: '이 점수 이상이면 후보로 제안 (0~1)' },
};

export default function SettingsPage() {
    const [settings,    setSettings]    = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [category,    setCategory]    = useState('all');

    // 편집 중인 값 (key → draft 값)
    const [drafts,      setDrafts]      = useState({});
    const [saving,      setSaving]      = useState(null);  // 현재 저장 중인 key

    // 토스트
    const [toast,       setToast]       = useState('');

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    // ===== 설정 조회 =====
    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const params = category !== 'all' ? { category } : {};
            const data   = await getSettings(params);
            const list   = data.settings || [];
            setSettings(list);

            // draft 초기화 (기존 draft가 없는 항목만)
            setDrafts(prev => {
                const next = { ...prev };
                list.forEach(s => {
                    if (!(s.key in next)) next[s.key] = s.value;
                });
                return next;
            });
        } catch (err) {
            console.error('설정 조회 오류:', err.message);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    // ===== 설정 저장 =====
    const handleSave = async (key) => {
        if (saving) return;
        try {
            setSaving(key);
            await updateSetting(key, drafts[key]);
            setSettings(prev => prev.map(s => s.key === key ? { ...s, value: drafts[key] } : s));
            showToast(`"${KEY_INFO[key]?.label || key}" 저장 완료`);
        } catch (err) {
            alert('설정 저장에 실패했습니다.');
        } finally {
            setSaving(null);
        }
    };

    // ===== 변경 여부 확인 =====
    const isDirty = (s) => drafts[s.key] !== s.value;

    return (
        <AdminLayout>
            {/* 토스트 */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 24, right: 24, zIndex: 9999,
                    background: '#2ecc71', color: 'white',
                    padding: '10px 20px', borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    fontSize: 14, fontWeight: 600
                }}>
                    ✓ {toast}
                </div>
            )}

            <div className="card-header">
                <h2>⚙️ 운영 설정</h2>
                <button className="btn btn-secondary btn-sm" onClick={fetchSettings}>
                    🔄 새로고침
                </button>
            </div>

            {/* 카테고리 탭 */}
            <div className="filter-bar" style={{ marginBottom: 16 }}>
                {CATEGORIES.map(c => (
                    <button
                        key={c.key}
                        className={`filter-btn ${category === c.key ? 'active' : ''}`}
                        onClick={() => setCategory(c.key)}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {/* 설정 목록 */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div className="loading"><div className="spinner"></div> 불러오는 중...</div>
                ) : settings.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: 32, marginBottom: 8 }}>⚙️</p>
                        <p>설정 항목이 없습니다.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg)', fontSize: 12, color: 'var(--text-muted)' }}>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, width: '25%' }}>설정 항목</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>값</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, width: '30%' }}>설명</th>
                                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, width: 80 }}>저장</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settings.map((s, idx) => {
                                const info  = KEY_INFO[s.key] || {};
                                const dirty = isDirty(s);
                                return (
                                    <tr
                                        key={s.key}
                                        style={{
                                            borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                                            background: dirty ? '#fffdf0' : 'white'
                                        }}
                                    >
                                        {/* 설정 키 */}
                                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                                                {info.label || s.key}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                                                {s.key}
                                            </div>
                                            {s.category && (
                                                <span style={{
                                                    fontSize: 10, padding: '1px 5px',
                                                    background: 'var(--bg)', borderRadius: 4,
                                                    color: 'var(--text-muted)', marginTop: 4, display: 'inline-block'
                                                }}>
                                                    {s.category}
                                                </span>
                                            )}
                                        </td>

                                        {/* 값 입력 */}
                                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                                            {s.key.includes('threshold') ? (
                                                // 임계값은 숫자 입력
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    min="0"
                                                    max="1"
                                                    className="form-input"
                                                    style={{ width: 120, padding: '6px 10px', fontSize: 13 }}
                                                    value={drafts[s.key] ?? s.value}
                                                    onChange={e => setDrafts(prev => ({ ...prev, [s.key]: e.target.value }))}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
                                                    value={drafts[s.key] ?? s.value}
                                                    onChange={e => setDrafts(prev => ({ ...prev, [s.key]: e.target.value }))}
                                                    onKeyDown={e => e.key === 'Enter' && dirty && handleSave(s.key)}
                                                />
                                            )}
                                        </td>

                                        {/* 설명 */}
                                        <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: 12, color: 'var(--text-muted)' }}>
                                            {info.desc || '-'}
                                        </td>

                                        {/* 저장 버튼 */}
                                        <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                style={{ fontSize: 11, padding: '4px 12px', opacity: dirty ? 1 : 0.4 }}
                                                onClick={() => handleSave(s.key)}
                                                disabled={!dirty || saving === s.key}
                                            >
                                                {saving === s.key ? '저장 중' : dirty ? '저장' : '저장됨'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* 안내 */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0f4ff', borderRadius: 8, fontSize: 12, color: '#5563de' }}>
                💡 답변 템플릿에서 <code style={{ fontFamily: 'monospace', background: 'white', padding: '1px 4px', borderRadius: 3 }}>{'{{key}}'}</code> 형식으로 설정값을 참조할 수 있습니다.
                예: <code style={{ fontFamily: 'monospace', background: 'white', padding: '1px 4px', borderRadius: 3 }}>{'{{check_in_time}}'}</code>
            </div>
        </AdminLayout>
    );
}
