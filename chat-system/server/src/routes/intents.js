// ============================================================
// FAQ 의도 관리 라우트 (intents.js)
// ============================================================
// 관리자가 FAQ 의도(질문/답변 세트)를 관리하는 API입니다.
//
// 엔드포인트:
//   GET    /api/admin/intents          — 전체 의도 목록 조회
//   POST   /api/admin/intents          — 새 의도 생성
//   GET    /api/admin/intents/:id      — 특정 의도 상세 조회 (질문/답변 포함)
//   PATCH  /api/admin/intents/:id      — 의도 수정 (활성화/비활성화 등)
//   DELETE /api/admin/intents/:id      — 의도 삭제
//   POST   /api/admin/intents/:id/questions — 유사 질문 추가
//   DELETE /api/admin/intents/:id/questions/:qid — 유사 질문 삭제
//   PUT    /api/admin/intents/:id/answers/:lang  — 언어별 답변 저장 (없으면 생성, 있으면 수정)
// ============================================================

const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../db/supabase');


/**
 * GET /api/admin/intents
 * 전체 FAQ 의도 목록을 조회합니다.
 *
 * 응답: { intents: Array }
 */
router.get('/', async (req, res) => {
    try {
        const { data: intents, error } = await supabaseAdmin
            .from('intents')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ intents: intents || [] });

    } catch (err) {
        console.error('[Intents] 목록 조회 에러:', err.message);
        res.status(500).json({ error: 'FAQ 목록 조회에 실패했습니다.' });
    }
});


/**
 * POST /api/admin/intents
 * 새 FAQ 의도를 생성합니다.
 *
 * 요청 본문: { id: string, category: string, display_order?: number }
 * 응답: { intent: Object }
 */
router.post('/', async (req, res) => {
    const { id, category = '일반', display_order = 0 } = req.body;

    if (!id) {
        return res.status(400).json({ error: '의도 ID(id)가 필요합니다.' });
    }

    try {
        const { data: intent, error } = await supabaseAdmin
            .from('intents')
            .insert({ id, category, display_order })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ intent });

    } catch (err) {
        // 중복 ID 에러 처리
        if (err.code === '23505') {
            return res.status(409).json({ error: '이미 존재하는 의도 ID입니다.' });
        }
        console.error('[Intents] 생성 에러:', err.message);
        res.status(500).json({ error: 'FAQ 의도 생성에 실패했습니다.' });
    }
});


/**
 * GET /api/admin/intents/:id
 * 특정 FAQ 의도의 상세 정보를 조회합니다.
 * 유사 질문 목록과 언어별 답변 템플릿을 함께 반환합니다.
 *
 * 응답: { intent: Object, questions: Array, answers: Array }
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 의도 기본 정보, 유사 질문, 답변 템플릿을 병렬로 조회
        const [intentRes, questionsRes, answersRes] = await Promise.all([
            supabaseAdmin.from('intents').select('*').eq('id', id).single(),
            supabaseAdmin.from('intent_questions').select('*').eq('intent_id', id).order('created_at'),
            supabaseAdmin.from('intent_answers').select('*').eq('intent_id', id).order('language')
        ]);

        if (!intentRes.data) {
            return res.status(404).json({ error: '해당 FAQ 의도를 찾을 수 없습니다.' });
        }

        res.json({
            intent:    intentRes.data,
            questions: questionsRes.data || [],
            answers:   answersRes.data   || []
        });

    } catch (err) {
        console.error('[Intents] 상세 조회 에러:', err.message);
        res.status(500).json({ error: '상세 정보 조회에 실패했습니다.' });
    }
});


/**
 * PATCH /api/admin/intents/:id
 * FAQ 의도 정보를 수정합니다. (활성화/비활성화, 카테고리 변경 등)
 *
 * 요청 본문: { is_active?: boolean, category?: string, display_order?: number }
 * 응답: { intent: Object }
 */
router.patch('/:id', async (req, res) => {
    const { id }  = req.params;
    const updates = {};

    if (req.body.is_active      !== undefined) updates.is_active      = req.body.is_active;
    if (req.body.category       !== undefined) updates.category       = req.body.category;
    if (req.body.display_order  !== undefined) updates.display_order  = req.body.display_order;
    updates.updated_at = new Date().toISOString();

    try {
        const { data: intent, error } = await supabaseAdmin
            .from('intents')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ intent });

    } catch (err) {
        console.error('[Intents] 수정 에러:', err.message);
        res.status(500).json({ error: 'FAQ 의도 수정에 실패했습니다.' });
    }
});


/**
 * DELETE /api/admin/intents/:id
 * FAQ 의도를 삭제합니다. (연관된 질문/답변도 CASCADE 삭제됩니다)
 *
 * 응답: { success: true }
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabaseAdmin
            .from('intents')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });

    } catch (err) {
        console.error('[Intents] 삭제 에러:', err.message);
        res.status(500).json({ error: 'FAQ 의도 삭제에 실패했습니다.' });
    }
});


/**
 * POST /api/admin/intents/:id/questions
 * 유사 질문 표현을 추가합니다.
 *
 * 요청 본문: { language: string, question_text: string }
 * 응답: { question: Object }
 */
router.post('/:id/questions', async (req, res) => {
    const { id } = req.params;
    const { language = 'ko', question_text } = req.body;

    if (!question_text || question_text.trim() === '') {
        return res.status(400).json({ error: '질문 텍스트(question_text)가 필요합니다.' });
    }

    try {
        const { data: question, error } = await supabaseAdmin
            .from('intent_questions')
            .insert({ intent_id: id, language, question_text: question_text.trim() })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ question });

    } catch (err) {
        console.error('[Intents] 질문 추가 에러:', err.message);
        res.status(500).json({ error: '유사 질문 추가에 실패했습니다.' });
    }
});


/**
 * DELETE /api/admin/intents/:id/questions/:qid
 * 특정 유사 질문을 삭제합니다.
 *
 * 응답: { success: true }
 */
router.delete('/:id/questions/:qid', async (req, res) => {
    const { qid } = req.params;
    try {
        const { error } = await supabaseAdmin
            .from('intent_questions')
            .delete()
            .eq('id', qid);

        if (error) throw error;
        res.json({ success: true });

    } catch (err) {
        console.error('[Intents] 질문 삭제 에러:', err.message);
        res.status(500).json({ error: '유사 질문 삭제에 실패했습니다.' });
    }
});


/**
 * PUT /api/admin/intents/:id/answers/:lang
 * 특정 언어의 답변 템플릿을 저장합니다.
 * 기존에 없으면 생성, 있으면 덮어씁니다. (Upsert)
 *
 * 요청 본문: { answer_template: string }
 * 응답: { answer: Object }
 */
router.put('/:id/answers/:lang', async (req, res) => {
    const { id, lang }   = req.params;
    const { answer_template } = req.body;

    if (!answer_template || answer_template.trim() === '') {
        return res.status(400).json({ error: '답변 템플릿(answer_template)이 필요합니다.' });
    }

    try {
        // onConflict: intent_id + language 조합이 중복이면 update
        const { data: answer, error } = await supabaseAdmin
            .from('intent_answers')
            .upsert(
                { intent_id: id, language: lang, answer_template: answer_template.trim(), updated_at: new Date().toISOString() },
                { onConflict: 'intent_id,language' }
            )
            .select()
            .single();

        if (error) throw error;
        res.json({ answer });

    } catch (err) {
        console.error('[Intents] 답변 저장 에러:', err.message);
        res.status(500).json({ error: '답변 저장에 실패했습니다.' });
    }
});


module.exports = router;
