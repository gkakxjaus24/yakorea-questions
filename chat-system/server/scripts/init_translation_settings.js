// 자동 번역 기능 초기 설정
// - settings.translation_enabled=false upsert
// - translation_logs 테이블 존재 확인
// - messages.content_translated / chat_rooms.guest_lang 컬럼 확인
//
// DDL은 Supabase 대시보드 SQL Editor에서
// scripts/migrations/create_translation_logs.sql 직접 실행 필요.
require('dotenv').config({ override: true });
const supabase = require('../src/services/supabase');

(async () => {
  const KEY = 'translation_enabled';

  // 1) settings 토글 플래그 upsert
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
    console.log(`✓ settings.${KEY}='false' 삽입 완료 (기본 OFF)`);
  }

  // 2) translation_logs 테이블 존재 확인
  const { error: logsErr } = await supabase
    .from('translation_logs')
    .select('id')
    .limit(1);

  if (logsErr) {
    console.log('');
    console.log('⚠ translation_logs 테이블이 없습니다.');
    console.log('  Supabase 대시보드 → SQL Editor에서 실행해주세요:');
    console.log('  → server/scripts/migrations/create_translation_logs.sql');
    process.exit(2);
  }
  console.log('✓ translation_logs 테이블 준비 완료');

  // 3) messages.content_translated 컬럼 확인
  const { error: colErr } = await supabase
    .from('messages')
    .select('content_translated')
    .limit(1);

  if (colErr) {
    console.log('');
    console.log('⚠ messages.content_translated 컬럼이 없습니다.');
    console.log('  마이그레이션 SQL을 실행했는지 확인해주세요.');
    process.exit(3);
  }
  console.log('✓ messages.content_translated 컬럼 준비 완료');

  // 4) chat_rooms.guest_lang 컬럼 확인
  const { error: langErr } = await supabase
    .from('chat_rooms')
    .select('guest_lang')
    .limit(1);

  if (langErr) {
    console.log('');
    console.log('⚠ chat_rooms.guest_lang 컬럼이 없습니다.');
    console.log('  마이그레이션 SQL을 실행했는지 확인해주세요.');
    process.exit(4);
  }
  console.log('✓ chat_rooms.guest_lang 컬럼 준비 완료');

  console.log('\n초기화 완료.');
  console.log("활성화: settings에서 translation_enabled='true'로 변경");
})();
