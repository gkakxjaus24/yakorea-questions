// ============================================================
// 인증 라우트 (auth.js)
// ============================================================
// 관리자(매니저) 로그인/인증을 처리합니다.
//
// 엔드포인트:
//   POST /api/auth/login   — 이메일 + 비밀번호로 JWT 토큰 발급
//   GET  /api/auth/me      — 현재 로그인된 관리자 정보 반환
//
// 인증 방식:
//   - 로그인 성공 시 JWT 토큰 발급 (유효기간 7일)
//   - 이후 요청은 Authorization: Bearer <token> 헤더로 인증
//   - 계정은 .env의 MANAGER_EMAIL + MANAGER_PASSWORD 사용
//     (단일 매니저 계정. 복수 계정 필요 시 DB 테이블로 확장)
// ============================================================

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');

// JWT 서명 키 (.env에서 가져옴)
const JWT_SECRET = process.env.JWT_SECRET || 'yakorea-default-secret';
// 토큰 유효기간 (7일)
const JWT_EXPIRES_IN = '7d';


/**
 * POST /api/auth/login
 * 이메일 + 비밀번호로 로그인합니다.
 *
 * 요청 본문: { email: string, password: string }
 * 응답: { token: string, manager: { email: string, role: string } }
 */
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    // 필수 필드 확인
    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    // .env에 설정된 매니저 계정과 비교
    // 보안: 실제 운영에서는 bcrypt 해시 비교 권장. 현재는 단일 계정이므로 단순 비교 사용.
    const validEmail    = process.env.MANAGER_EMAIL    || 'manager@yakorea.com';
    const validPassword = process.env.MANAGER_PASSWORD || 'yakorea2026';

    if (email !== validEmail || password !== validPassword) {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 로그인 성공 → JWT 토큰 발급
    const payload = { email, role: 'manager' };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`🔐 관리자 로그인 성공: ${email}`);

    res.json({
        token,
        manager: { email, role: 'manager' }
    });
});


/**
 * GET /api/auth/me
 * 현재 로그인된 관리자 정보를 반환합니다.
 * Authorization 헤더의 JWT 토큰을 검증합니다.
 *
 * 헤더: Authorization: Bearer <token>
 * 응답: { manager: { email: string, role: string } }
 */
router.get('/me', verifyToken, (req, res) => {
    // verifyToken 미들웨어가 통과하면 req.manager에 페이로드가 설정됨
    res.json({
        manager: {
            email: req.manager.email,
            role:  req.manager.role
        }
    });
});


module.exports = router;
