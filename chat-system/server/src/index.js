// ============================================================
// 야코리아 채팅 서버 V2 — 진입점 (index.js)
// ============================================================
// Express 서버를 생성하고, 라우트를 연결하고,
// Socket.IO 실시간 통신을 설정하는 메인 파일입니다.
//
// 실행 방법:
//   개발:  npm run dev   (nodemon으로 파일 변경 시 자동 재시작)
//   배포:  npm start     (일반 node 실행)
// ============================================================

// 가장 먼저 .env 파일을 로드합니다. (모든 require보다 앞에 있어야 합니다)
require('dotenv').config();

// ========== 외부 라이브러리 ==========
const express  = require('express');      // 웹 서버 프레임워크
const http     = require('http');         // Socket.IO를 위한 기본 HTTP 서버
const path     = require('path');         // 파일 경로 처리
const { Server } = require('socket.io'); // 실시간 양방향 통신
const cors     = require('cors');         // 다른 도메인에서의 API 요청 허용

// ========== 내부 모듈 ==========
const authRoutes     = require('./routes/auth');         // 관리자 로그인/인증 API
const chatRoutes     = require('./routes/chat');         // 채팅 대화방/메시지 API
const intentRoutes   = require('./routes/intents');      // FAQ 의도 관리 API
const settingsRoutes = require('./routes/settings');     // 운영 설정 API
const initSocket     = require('./socket/handlers');     // Socket.IO 이벤트 핸들러

// ========== 서버 초기 설정 ==========
const app    = express();
const server = http.createServer(app);  // express 앱을 http 서버로 감쌉니다
const PORT   = process.env.PORT || 3001;

// CORS 허용 도메인 목록 파싱 (.env의 ALLOWED_ORIGINS 값, 쉼표 구분)
// 와일드카드(*) 지원: "*.vercel.app" 형태로 서브도메인 전체 허용 가능
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);  // 빈 문자열 제거

// origin이 허용 목록에 있는지 확인 (와일드카드 패턴 지원)
function isOriginAllowed(origin) {
    if (!origin) return true;  // origin 없으면 같은 서버 요청 (Postman, 로컬파일 등)
    return allowedOrigins.some(allowed => {
        if (allowed.startsWith('*.')) {
            // 와일드카드 패턴: *.vercel.app → .vercel.app 으로 끝나는지 확인
            const suffix = allowed.slice(1);  // "*.vercel.app" → ".vercel.app"
            return origin.endsWith(suffix);
        }
        return allowed === origin;
    });
}

// ========== Socket.IO 설정 ==========
// Socket.IO는 HTTP 서버 위에서 동작합니다.
const io = new Server(server, {
    cors: {
        origin:  (origin, callback) => {
            if (isOriginAllowed(origin)) callback(null, true);
            else callback(new Error(`CORS 차단: ${origin}`));
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
    // 연결 끊김 시 재연결 설정 (기본값 사용)
    pingTimeout:  60000,  // 60초 응답 없으면 연결 끊김 처리
    pingInterval: 25000   // 25초마다 ping 전송
});

// ========== Express 미들웨어 ==========

// CORS: 다른 도메인(예: 위젯이 설치된 숙소 홈페이지)에서의 요청을 허용
app.use(cors({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) callback(null, true);
        else callback(new Error(`CORS 차단: ${origin}`));
    },
    credentials: true  // 쿠키/Authorization 헤더 포함 허용
}));

// JSON 파싱: 요청 본문의 JSON을 자동으로 파싱
app.use(express.json());

// 요청 로깅 미들웨어: 개발 시 API 호출 현황 파악용
// 배포 환경에서는 morgan 같은 전문 라이브러리로 교체 권장
if (process.env.NODE_ENV !== 'production') {
    const methodColors = { GET: '\x1b[32m', POST: '\x1b[33m', PUT: '\x1b[34m', PATCH: '\x1b[35m', DELETE: '\x1b[31m' };
    app.use((req, res, next) => {
        const color = methodColors[req.method] || '\x1b[0m';
        const time  = new Date().toLocaleTimeString('ko-KR');
        console.log(`${color}[${time}] ${req.method}\x1b[0m ${req.url}`);
        next();
    });
}

// ========== 위젯 정적 파일 서빙 ==========
// 채팅 위젯 JS 파일을 서버에서 직접 제공합니다.
// 캐시 문제를 방지하기 위해 항상 최신 파일을 제공합니다.
app.get('/widget/chat-widget.js', (req, res) => {
    const filePath = path.join(__dirname, '../../widget/dist/chat-widget.js');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(filePath);
});

// 위젯 테스트 페이지 (개발 시 편의용)
app.use('/widget', express.static(path.join(__dirname, '../../widget/dist')));

// ========== API 라우트 연결 ==========

// 헬스 체크: 서버가 살아있는지 확인하는 간단한 엔드포인트
// 로드밸런서, 모니터링 툴에서 주기적으로 호출합니다.
app.get('/api/health', (req, res) => {
    res.json({
        status:    'ok',
        service:   '야코리아 채팅 서버 V2',
        env:       process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// 인증 API (로그인, 내 정보)
app.use('/api/auth', authRoutes);

// 채팅 관련 API
app.use('/api/chat', chatRoutes);

// FAQ 의도 관리 API (관리자용)
app.use('/api/admin/intents', intentRoutes);

// 운영 설정 API (관리자용)
app.use('/api/admin/settings', settingsRoutes);

// ========== Socket.IO 이벤트 핸들러 등록 ==========
initSocket(io);

// io 인스턴스를 Express 앱에 저장 (필요 시 다른 라우터에서 접근 가능)
app.set('io', io);

// ========== 에러 핸들러 ==========

// 404 처리: 등록되지 않은 API 경로 요청
app.use((req, res) => {
    res.status(404).json({
        error: '요청한 API 경로를 찾을 수 없습니다.',
        path:  req.url
    });
});

// 500 처리: 처리되지 않은 서버 에러
app.use((err, req, res, _next) => {
    console.error('[서버 에러]', err.message);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

// ========== 서버 시작 ==========
server.listen(PORT, () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const addr = isProduction ? `포트 ${PORT}` : `http://localhost:${PORT}`;

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║      🏨  야코리아 채팅 서버 V2            ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  📡 주소: ${addr.padEnd(33)}║`);
    console.log(`║  🔧 환경: ${(process.env.NODE_ENV || 'development').padEnd(32)}║`);
    console.log(`║  🌐 CORS: ${allowedOrigins.length}개 도메인/패턴 허용             ║`);
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  API 엔드포인트:                          ║');
    console.log(`║  GET  /api/health                        ║`);
    console.log(`║  POST /api/auth/login                    ║`);
    console.log(`║  GET  /api/auth/me                       ║`);
    console.log(`║  POST /api/chat/rooms                    ║`);
    console.log(`║  GET  /api/chat/admin/rooms              ║`);
    console.log(`║  GET  /api/admin/intents                 ║`);
    console.log(`║  GET  /api/admin/settings                ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
