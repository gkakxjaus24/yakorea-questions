// reservation_search intent 학습 변형 추가 (6개 언어)
require('dotenv').config();
const supabase = require('../src/services/supabase');

const INTENT_ID = 'reservation_search';

const VARIANTS = {
  ko: [
    '예약번호가 안나와요',
    '예약번호가 없어요',
    '예약번호가 안 나와요',
    '예약번호를 찾을 수 없어요',
    '예약번호를 못 찾겠어요',
    '예약번호가 없대요',
    '예약번호가 없다고 나와요',
    '예약번호가 안맞아요',
    '예약번호가 안 맞아요',
    '예약번호가 틀렸대요',
    '예약번호 입력해도 안나와요',
    '예약번호 입력해도 안 나와요',
    '예약번호로 검색이 안돼요',
    '예약번호로 안 찾아져요',
    '예약 정보가 안 보여요',
    '예약이 안 나와요',
    '예약을 찾을 수 없어요',
    '예약번호 모르겠어요',
    '예약번호 어디서 봐요',
    '키오스크에서 예약번호가 안 나와요',
  ],
  en: [
    "I can't find my reservation number",
    "I don't have a reservation number",
    "My reservation number doesn't work",
    "Reservation number not found",
    "The reservation number is wrong",
    "Reservation number is invalid",
    "Can't find my booking",
    "My booking is not showing",
    "Reservation not found",
    "Where is my reservation number",
    "I don't know my reservation number",
    "Booking number not working",
    "Can't search by reservation number",
    "The kiosk says my reservation number is wrong",
  ],
  zh: [
    '找不到预订号',
    '没有预订号',
    '预订号无效',
    '预订号不对',
    '预订号错误',
    '输入预订号也找不到',
    '预订号搜不到',
    '查不到预订',
    '预订号在哪里看',
    '不知道预订号',
    '订单号找不到',
    '系统说预订号不对',
  ],
  ja: [
    '予約番号が見つかりません',
    '予約番号がありません',
    '予約番号が分かりません',
    '予約番号が違うと出ます',
    '予約番号が間違っていると出ます',
    '予約番号を入力しても出ません',
    '予約番号で検索できません',
    '予約が見つかりません',
    '予約番号はどこで見られますか',
    '予約番号が無効です',
    '予約番号がわからない',
  ],
  ru: [
    'Не могу найти номер бронирования',
    'У меня нет номера бронирования',
    'Номер бронирования не работает',
    'Номер бронирования неверный',
    'Не нахожу бронь по номеру',
    'Бронирование не найдено',
    'Где посмотреть номер бронирования',
    'Не знаю номер бронирования',
    'Номер брони не подходит',
  ],
  es: [
    'No encuentro mi número de reserva',
    'No tengo número de reserva',
    'El número de reserva no funciona',
    'El número de reserva es incorrecto',
    'No puedo buscar con el número de reserva',
    'No aparece mi reserva',
    'Reserva no encontrada',
    '¿Dónde veo mi número de reserva?',
    'No sé mi número de reserva',
  ],
};

(async () => {
  // 중복 방지: 기존 question_text 가져오기
  const { data: existing, error: eErr } = await supabase
    .from('intent_questions')
    .select('question_text, language')
    .eq('intent_id', INTENT_ID);
  if (eErr) { console.error(eErr); process.exit(1); }
  const have = new Set((existing || []).map((r) => `${r.language || 'ko'}::${r.question_text}`));

  const rows = [];
  for (const [language, list] of Object.entries(VARIANTS)) {
    for (const q of list) {
      if (have.has(`${language}::${q}`)) continue;
      rows.push({ intent_id: INTENT_ID, question_text: q, language });
    }
  }

  console.log(`삽입 대상: ${rows.length}건 (이미 있는 것은 스킵)`);
  if (rows.length === 0) return;

  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('intent_questions').insert(slice);
    if (error) { console.error(`[${i}] 에러:`, error.message); process.exit(1); }
    console.log(`  ${Math.min(i + CHUNK, rows.length)}/${rows.length} 삽입 완료`);
  }

  // 검증: 언어별 reservation_search 변형 수
  const { data: after } = await supabase
    .from('intent_questions')
    .select('language')
    .eq('intent_id', INTENT_ID);
  const counts = {};
  (after || []).forEach(({ language }) => {
    const l = language || 'ko';
    counts[l] = (counts[l] || 0) + 1;
  });
  console.log(`\n${INTENT_ID} 언어별 변형 수:`, counts);
})();
