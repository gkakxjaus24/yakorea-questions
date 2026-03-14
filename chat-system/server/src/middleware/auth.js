// ============================================================
// JWT 인증 미들웨어 (auth.js)
// ============================================================
// API 라우트에서 인증이 필요한 엔드포인트를 보호합니다.
//
// 사용 방법:
//   const { verifyToken } = require('../middleware/auth');
//   router.get('/protected', verifyToken, (req, res) => { ... });
//
// 동작:
//   Authorization: Bearer <JWT_TOKEN> 헤더를 검사하여
//   유효한 토큰이면 req.manager에 페이로드를 설정하고 다음으로 진행,
//   유효하지 않으면 401 에러를 반환합니다.
// ============================================================

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'yakorea-default-secret';


/**
 * JWT 토큰 검증 미들웨어
 * Authorization 헤더에서 Bearer 토큰을 추출하여 검증합니다.
 */
function verifyToken(req, res, next) {
    // Authorization 헤더 확인
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    // "Bearer " 접두사 제거 후 토큰만 추출
    const token = authHeader.slice(7);

    try {
        // JWT 검증
        const payload = jwt.verify(token, JWT_SECRET);
        req.manager = payload;  // 이후 라우트 핸들러에서 req.manager로 접근 가능
        next();
    } catch (err) {
        // 토큰 만료 또는 서명 불일치
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
        }
        return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
}


module.exports = { verifyToken };
