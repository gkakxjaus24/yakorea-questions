// ============================================================
// FAQ 관리 페이지 (/faq)
// ============================================================
// 자동응답에 사용되는 FAQ 의도(Intent) 목록을 관리합니다.
//
// 주요 기능:
//   - 의도 목록 조회 및 활성/비활성 토글
//   - 의도 클릭 시 질문 목록 및 언어별 답변 템플릿 편집
//   - 질문 추가/삭제
//   - 언어별 답변 저장
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { getIntents, getIntentDetail, toggleIntent, addQuestion, deleteQuestion, saveAnswer } from '@/lib/api';

// 지원 언어 목록
const LANGUAGES = [
    { code: 'ko', label: '🇰🇷 한국어' },
    { code: 'en', label: '🇺🇸 English' },
    { code: 'zh', label: '🇨🇳 中文' },
    { code: 'ja', label: '🇯🇵 日本語' },
];

export default function FaqPage() {
    const [intents,        setIntents]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [selectedId,     setSelectedId]     = useState(null);   // 선택된 의도 ID
    const [detail,         setDetail]         = useState(null);   // 선택된 의도 상세
    const [detailLoading,  setDetailLoading]  = useState(false);

    // 질문 추가 입력값
    const [newQuestion,    setNewQuestion]    = useState('');
    const [newQuestLang,   setNewQuestLang]   = useState('ko');
    const [addingQ,        setAddingQ]        = useState(false);

    // 답변 편집 (언어 → 내용)
    const [answerDrafts,   setAnswerDrafts]   = useState({});  // { ko: '...', en: '...' }
    const [savingLang,     setSavingLang]     = useState(null);

    // 토스트 메시지
    const [toast,          setToast]          = useState('');

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    // ===== 의도 목록 조회 =====
    const fetchIntents = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getIntents();
            setIntents(data.intents || []);
        } catch (err) {
            console.error('의도 조회 오류:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchIntents(); }, [fetchIntents]);

    // ===== 의도 상세 조회 =====
    const fetchDetail = useCallback(async (intentId) => {
        try {
            setDetailLoading(true);
            setDetail(null);
            const data = await getIntentDetail(intentId);
            setDetail(data);

            // 답변 초기값 세팅
            const drafts = {};
            (data.answers || []).forEach(a => { drafts[a.language] = a.answer_template; });
            setAnswerDrafts(drafts);
        } catch (err) {
            console.error('의도 상세 조회 오류:', err.message);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const handleSelectIntent = (intent) => {
        setSelectedId(intent.id);
        fetchDetail(intent.id);
        setNewQuestion('');
    };

    // ===== 활성/비활성 토글 =====
    const handleToggle = async (intent, e) => {
        e.stopPropagation();
        try {
            await toggleIntent(intent.id, !intent.is_active);
            setIntents(prev => prev.map(i =>
                i.id === intent.id ? { ...i, is_active: !i.is_active } : i
            ));
            showToast(`"${intent.name}" ${!intent.is_active ? '활성화' : '비활성화'}됨`);
        } catch (err) {
            alert('상태 변경에 실패했습니다.');
        }
    };

    // ===== 질문 추가 =====
    const handleAddQuestion = async () => {
        const q = newQuestion.trim();
        if (!q || addingQ) return;
        try {
            setAddingQ(true);
            const data = await addQuestion(selectedId, q, newQuestLang);
            setDetail(prev => ({
                ...prev,
                questions: [...(prev.questions || []), data.question]
            }));
            setNewQuestion('');
            showToast('질문이 추가되었습니다.');
        } catch (err) {
            alert('질문 추가에 실패했습니다.');
        } finally {
            setAddingQ(false);
        }
    };

    // ===== 질문 삭제 =====
    const handleDeleteQuestion = async (qId) => {
        if (!confirm('이 질문을 삭제하시겠습니까?')) return;
        try {
            await deleteQuestion(qId);
            setDetail(prev => ({
                ...prev,
                questions: prev.questions.filter(q => q.id !== qId)
            }));
            showToast('질문이 삭제되었습니다.');
        } catch (err) {
            alert('질문 삭제에 실패했습니다.');
        }
    };

    // ===== 답변 저장 =====
    const handleSaveAnswer = async (lang) => {
        if (savingLang) return;
        try {
            setSavingLang(lang);
            await saveAnswer(selectedId, lang, answerDrafts[lang] || '');
            showToast(`${lang.toUpperCase()} 답변이 저장되었습니다.`);
        } catch (err) {
            alert('답변 저장에 실패했습니다.');
        } finally {
            setSavingLang(null);
        }
    };

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
                <h2>📋 FAQ 관리</h2>
                <button className="btn btn-secondary btn-sm" onClick={fetchIntents}>
                    🔄 새로고침
                </button>
            </div>

            {/* 2단 레이아웃: 좌(목록) + 우(상세) */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                {/* ===== 의도 목록 ===== */}
                <div className="card" style={{ width: 280, flexShrink: 0, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                        의도 목록 ({intents.length})
                    </div>

                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : intents.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            등록된 의도가 없습니다.
                        </div>
                    ) : (
                        <div>
                            {intents.map(intent => (
                                <div
                                    key={intent.id}
                                    onClick={() => handleSelectIntent(intent)}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border)',
                                        cursor: 'pointer',
                                        background: selectedId === intent.id ? 'var(--primary-light, #eef2ff)' : 'white',
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        transition: 'background 0.15s'
                                    }}
                                >
                                    {/* 활성/비활성 토글 */}
                                    <div
                                        onClick={(e) => handleToggle(intent, e)}
                                        style={{
                                            width: 36, height: 20, borderRadius: 10,
                                            background: intent.is_active ? 'var(--success)' : '#ccc',
                                            position: 'relative', cursor: 'pointer', flexShrink: 0,
                                            transition: 'background 0.2s'
                                        }}
                                        title={intent.is_active ? '비활성화' : '활성화'}
                                    >
                                        <div style={{
                                            position: 'absolute', top: 2,
                                            left: intent.is_active ? 18 : 2,
                                            width: 16, height: 16,
                                            borderRadius: '50%', background: 'white',
                                            transition: 'left 0.2s'
                                        }}/>
                                    </div>

                                    {/* 의도 이름 */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 13, fontWeight: selectedId === intent.id ? 700 : 500,
                                            color: intent.is_active ? 'var(--text)' : 'var(--text-muted)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {intent.name}
                                        </div>
                                        {intent.description && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                {intent.description}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ===== 상세 패널 ===== */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {!selectedId ? (
                        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                            <p>왼쪽에서 의도를 선택하면 상세 정보를 편집할 수 있습니다.</p>
                        </div>
                    ) : detailLoading ? (
                        <div className="card">
                            <div className="loading"><div className="spinner"></div> 불러오는 중...</div>
                        </div>
                    ) : detail ? (
                        <>
                            {/* 의도 헤더 */}
                            <div className="card" style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{detail.name}</h3>
                                        {detail.description && (
                                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                                {detail.description}
                                            </p>
                                        )}
                                    </div>
                                    <span className={`badge ${detail.is_active ? 'badge-active' : 'badge-closed'}`}>
                                        {detail.is_active ? '활성' : '비활성'}
                                    </span>
                                </div>
                            </div>

                            {/* 질문 목록 */}
                            <div className="card" style={{ marginBottom: 16 }}>
                                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                                    매칭 질문 ({(detail.questions || []).length}개)
                                </h4>

                                {(detail.questions || []).length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>등록된 질문이 없습니다.</p>
                                ) : (
                                    <div style={{ marginBottom: 16 }}>
                                        {detail.questions.map(q => (
                                            <div key={q.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '6px 0', borderBottom: '1px solid var(--border)'
                                            }}>
                                                <span style={{
                                                    fontSize: 11, padding: '2px 6px',
                                                    background: 'var(--bg)', borderRadius: 4,
                                                    color: 'var(--text-muted)', flexShrink: 0
                                                }}>
                                                    {q.language?.toUpperCase() || 'KO'}
                                                </span>
                                                <span style={{ flex: 1, fontSize: 13 }}>{q.question_text}</span>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    style={{ padding: '2px 8px', fontSize: 11 }}
                                                    onClick={() => handleDeleteQuestion(q.id)}
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 질문 추가 */}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                    <select
                                        className="form-input"
                                        style={{ width: 100, flexShrink: 0, padding: '6px 8px', fontSize: 13 }}
                                        value={newQuestLang}
                                        onChange={e => setNewQuestLang(e.target.value)}
                                    >
                                        {LANGUAGES.map(l => (
                                            <option key={l.code} value={l.code}>{l.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        className="form-input"
                                        style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                                        placeholder="새 질문 입력..."
                                        value={newQuestion}
                                        onChange={e => setNewQuestion(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
                                    />
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleAddQuestion}
                                        disabled={!newQuestion.trim() || addingQ}
                                    >
                                        {addingQ ? '추가 중...' : '+ 추가'}
                                    </button>
                                </div>
                            </div>

                            {/* 언어별 답변 템플릿 */}
                            <div className="card">
                                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                                    언어별 답변 템플릿
                                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                                        {'{{check_in_time}} 등의 변수를 사용할 수 있습니다.'}
                                    </span>
                                </h4>

                                {LANGUAGES.map(lang => (
                                    <div key={lang.code} style={{ marginBottom: 20 }}>
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            alignItems: 'center', marginBottom: 6
                                        }}>
                                            <label style={{ fontSize: 13, fontWeight: 600 }}>
                                                {lang.label}
                                            </label>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                style={{ fontSize: 11, padding: '3px 10px' }}
                                                onClick={() => handleSaveAnswer(lang.code)}
                                                disabled={savingLang === lang.code}
                                            >
                                                {savingLang === lang.code ? '저장 중...' : '저장'}
                                            </button>
                                        </div>
                                        <textarea
                                            className="form-textarea"
                                            rows={4}
                                            style={{ fontSize: 13, resize: 'vertical' }}
                                            placeholder={`${lang.label} 답변 템플릿 입력...`}
                                            value={answerDrafts[lang.code] || ''}
                                            onChange={e => setAnswerDrafts(prev => ({
                                                ...prev,
                                                [lang.code]: e.target.value
                                            }))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </AdminLayout>
    );
}
