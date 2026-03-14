// ============================================================
// Supabase 데이터베이스 연결 모듈 (supabase.js)
// ============================================================
// 이 파일 하나에서 Supabase 클라이언트를 생성하고 내보냅니다.
// 다른 모든 파일은 이 모듈을 불러와 DB를 사용합니다.
//
// 두 종류의 클라이언트를 제공합니다:
//   - supabase      : 일반 클라이언트 (손님 권한, anon key 사용)
//   - supabaseAdmin : 관리자 클라이언트 (전체 권한, service_role key 사용)
//                     → RLS(Row Level Security) 정책을 우회할 수 있으므로
//                       서버 내부 로직에서만 사용해야 합니다.
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// 환경변수에서 Supabase 주소와 키를 가져옵니다.
// 값이 없으면 서버 시작 시 에러 메시지를 출력합니다.
const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY     = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 필수 환경변수 누락 체크
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
    console.error('[DB] ❌ .env 파일에 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
    process.exit(1);  // 환경변수 없으면 서버 시작 자체를 막음
}

// --- 일반 클라이언트 (anon key) ---
// 손님 채팅, FAQ 조회 등 일반 기능에 사용합니다.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 관리자 클라이언트 (service_role key) ---
// RLS를 우회해야 하는 서버 내부 로직(메시지 저장, 자동응답 등)에 사용합니다.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        // 서버에서는 세션 관리가 필요 없으므로 자동 새로고침 비활성화
        autoRefreshToken: false,
        persistSession: false
    }
});

// 두 클라이언트를 모두 내보냅니다.
module.exports = { supabase, supabaseAdmin };
