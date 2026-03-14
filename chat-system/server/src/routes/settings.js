// ============================================================
// 운영 설정 라우트 (settings.js)
// ============================================================
// 관리자가 FAQ 답변 템플릿에서 사용하는 운영 정보를 관리하는 API입니다.
// 예: 체크인 시간, 와이파이 비밀번호, 연락처 등
//
// 엔드포인트:
//   GET   /api/admin/settings      — 전체 설정 목록 조회 (카테고리 필터 가능)
//   PUT   /api/admin/settings/:key — 특정 설정값 수정 (없으면 생성)
// ============================================================

const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../db/supabase');


/**
 * GET /api/admin/settings
 * 전체 운영 설정을 조회합니다.
 *
 * 쿼리 파라미터: category (time | contact | facility | message | auto_reply)
 * 응답: { settings: Array }
 */
router.get('/', async (req, res) => {
    const { category } = req.query;

    try {
        let query = supabaseAdmin
            .from('settings')
            .select('*')
            .order('category')
            .order('key');

        // 카테고리 필터 적용
        if (category) {
            query = query.eq('category', category);
        }

        const { data: settings, error } = await query;
        if (error) throw error;

        res.json({ settings: settings || [] });

    } catch (err) {
        console.error('[Settings] 목록 조회 에러:', err.message);
        res.status(500).json({ error: '설정 조회에 실패했습니다.' });
    }
});


/**
 * PUT /api/admin/settings/:key
 * 특정 설정값을 수정합니다. 없으면 새로 생성합니다. (Upsert)
 *
 * 요청 본문: { value: string, label?: string, category?: string }
 * 응답: { setting: Object }
 */
router.put('/:key', async (req, res) => {
    const { key }  = req.params;
    const { value, label, category } = req.body;

    if (value === undefined || value === null) {
        return res.status(400).json({ error: '설정값(value)이 필요합니다.' });
    }

    try {
        // 먼저 기존 설정이 있는지 확인
        const { data: existing } = await supabaseAdmin
            .from('settings')
            .select('*')
            .eq('key', key)
            .single();

        let result;
        if (existing) {
            // 기존 설정 업데이트
            const updates = { value, updated_at: new Date().toISOString() };
            if (label    !== undefined) updates.label    = label;
            if (category !== undefined) updates.category = category;

            const { data, error } = await supabaseAdmin
                .from('settings')
                .update(updates)
                .eq('key', key)
                .select()
                .single();
            if (error) throw error;
            result = data;
        } else {
            // 새 설정 생성
            const { data, error } = await supabaseAdmin
                .from('settings')
                .insert({ key, value, label: label || key, category: category || 'general' })
                .select()
                .single();
            if (error) throw error;
            result = data;
        }

        res.json({ setting: result });

    } catch (err) {
        console.error('[Settings] 설정 수정 에러:', err.message);
        res.status(500).json({ error: '설정 수정에 실패했습니다.' });
    }
});


module.exports = router;
