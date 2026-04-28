// LLM 폴백 초기 설정
// - settings 테이블에 llm_fallback_enabled=false upsert
// - llm_fallback_logs 테이블은 별도 SQL 마이그레이션을 Supabase 대시보드에서 실행
//   (서비스 키만으로 DDL은 Supabase REST에서 안 되므로)
require('dotenv').config();
const supabase = require('../src/services/supabase');

(async () => {
  // 1) settings에 토글 플래그 upsert
  const KEY = 'llm_fallback_enabled';
  const { data: existing } = await supabase
    .from('settings')
    .select('key, value')
    .eq('key', KEY)
    .maybeSingle();

  if (existing) {
    console.log(`✓ settings.${KEY} 이미 존재: '${existing.value}' (변경 없음)`);
  } else {
    const { error } = await supabase
      .from('settings')
      .insert({ key: KEY, value: 'false' });
    if (error) {
      console.error(`✗ settings.${KEY} 삽입 실패:`, error.message);
      process.exit(1);
    }
    console.log(`✓ settings.${KEY}='false' 삽입 완료 (기본 OFF — 수동 활성화 필요)`);
  }

  // 2) llm_fallback_logs 테이블 존재 확인
  const { error: probeErr } = await supabase
    .from('llm_fallback_logs')
    .select('id')
    .limit(1);

  if (probeErr) {
    console.log('');
    console.log('⚠ llm_fallback_logs 테이블이 없습니다.');
    console.log('  Supabase 대시보드 → SQL Editor에서 다음 파일을 실행해주세요:');
    console.log('  → server/scripts/migrations/create_llm_logs_table.sql');
    console.log('');
    console.log('  실행 후 다시 이 스크립트를 돌리면 검증됩니다.');
    process.exit(2);
  } else {
    console.log('✓ llm_fallback_logs 테이블 준비 완료');
  }

  console.log('\n초기화 완료. 이제 ANTHROPIC_API_KEY를 .env에 설정하고');
  console.log("settings에서 llm_fallback_enabled='true'로 바꾸면 활성화됩니다.");
})();
