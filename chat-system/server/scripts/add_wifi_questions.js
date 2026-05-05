/**
 * WiFi 트러블슈팅 학습 질문 추가 스크립트
 * - intent_id: 'wifi_info'
 * - 6개 언어 × 다양한 표현 변형
 * - 중복 질문은 무시 (ON CONFLICT DO NOTHING)
 */

require('dotenv').config();
const supabase = require('../src/services/supabase');

const INTENT_ID = 'wifi_info';

const NEW_QUESTIONS = [
  // ── 한국어 (ko) ── 조사 변형 + 비문 + 속어 전부 커버 ──────────────
  { language: 'ko', question_text: '와이파이가 안되요' },
  { language: 'ko', question_text: '와이파이가 안돼요' },
  { language: 'ko', question_text: '와이파이가 안됩니다' },
  { language: 'ko', question_text: '와이파이 안되요' },
  { language: 'ko', question_text: '와이파이 안돼요' },
  { language: 'ko', question_text: '와이파이 안됩니다' },
  { language: 'ko', question_text: '와이파이 연결이 안되요' },
  { language: 'ko', question_text: '와이파이 연결이 안돼요' },
  { language: 'ko', question_text: '와이파이 연결이 안됩니다' },
  { language: 'ko', question_text: '와이파이 연결 안됩니다' },
  { language: 'ko', question_text: '와이파이 연결이 안 돼요' },
  { language: 'ko', question_text: '와이파이 신호가 안잡혀요' },
  { language: 'ko', question_text: '와이파이 신호가 약해요' },
  { language: 'ko', question_text: '와이파이 신호가 없어요' },
  { language: 'ko', question_text: '인터넷이 안되요' },
  { language: 'ko', question_text: '인터넷이 안돼요' },
  { language: 'ko', question_text: '인터넷이 안됩니다' },
  { language: 'ko', question_text: '인터넷 연결이 안됩니다' },
  { language: 'ko', question_text: '인터넷이 느려요' },
  { language: 'ko', question_text: '인터넷이 끊겼어요' },
  { language: 'ko', question_text: '와이파이 안되여' },
  { language: 'ko', question_text: '와이파이가 안터져요' },
  { language: 'ko', question_text: 'wifi 안됩니다' },
  { language: 'ko', question_text: 'wifi가 안돼요' },
  { language: 'ko', question_text: '와이파이 터지나요' },
  { language: 'ko', question_text: '와이파이가 끊겨요' },
  { language: 'ko', question_text: '와이파이가 자꾸 끊겨요' },
  { language: 'ko', question_text: '와이파이 접속이 안 돼요' },
  { language: 'ko', question_text: '네트워크 연결이 안됩니다' },
  { language: 'ko', question_text: '인터넷 안되면 어떡해요' },

  // ── 영어 (en) ── informal + formal + common phrasings ────────────
  { language: 'en', question_text: 'wifi not working' },
  { language: 'en', question_text: 'wifi doesn\'t work' },
  { language: 'en', question_text: 'can\'t connect to wifi' },
  { language: 'en', question_text: 'cannot connect to wifi' },
  { language: 'en', question_text: 'wifi connection failed' },
  { language: 'en', question_text: 'wifi keeps disconnecting' },
  { language: 'en', question_text: 'internet not working' },
  { language: 'en', question_text: 'no internet connection' },
  { language: 'en', question_text: 'wifi password not working' },
  { language: 'en', question_text: 'wifi won\'t connect' },
  { language: 'en', question_text: 'the wifi is down' },
  { language: 'en', question_text: 'wifi problem' },
  { language: 'en', question_text: 'how do i fix the wifi' },
  { language: 'en', question_text: 'wifi signal is weak' },
  { language: 'en', question_text: 'bad wifi signal' },
  { language: 'en', question_text: 'wifi is slow' },
  { language: 'en', question_text: 'internet is slow' },
  { language: 'en', question_text: 'wifi stops working' },
  { language: 'en', question_text: 'lost wifi connection' },
  { language: 'en', question_text: 'wifi is not working' },
  { language: 'en', question_text: 'no wifi' },
  { language: 'en', question_text: 'wifi issues' },
  { language: 'en', question_text: 'internet issues' },
  { language: 'en', question_text: 'wifi keeps cutting out' },
  { language: 'en', question_text: 'i have no internet' },
  { language: 'en', question_text: 'unable to connect to wifi' },
  { language: 'en', question_text: 'wifi drops frequently' },
  { language: 'en', question_text: 'connection keeps dropping' },
  { language: 'en', question_text: 'internet connection problem' },
  { language: 'en', question_text: 'network not working' },

  // ── 중국어 (zh) ── 연결 문제 다양한 표현 ─────────────────────────
  { language: 'zh', question_text: 'wifi连不上' },
  { language: 'zh', question_text: '连不上wifi' },
  { language: 'zh', question_text: 'wifi无法连接' },
  { language: 'zh', question_text: '网络不好' },
  { language: 'zh', question_text: '没有网络' },
  { language: 'zh', question_text: '网络连接失败' },
  { language: 'zh', question_text: 'wifi密码不对' },
  { language: 'zh', question_text: 'wifi密码错误' },
  { language: 'zh', question_text: '无法上网' },
  { language: 'zh', question_text: '上不了网' },
  { language: 'zh', question_text: 'wifi信号弱' },
  { language: 'zh', question_text: 'wifi信号差' },
  { language: 'zh', question_text: '网速慢' },
  { language: 'zh', question_text: 'wifi断了' },
  { language: 'zh', question_text: 'wifi断线了' },
  { language: 'zh', question_text: 'wifi掉线了' },
  { language: 'zh', question_text: 'wifi有问题' },
  { language: 'zh', question_text: '网络有问题' },
  { language: 'zh', question_text: '怎么连wifi' },
  { language: 'zh', question_text: '怎么用wifi' },
  { language: 'zh', question_text: 'wifi不稳定' },
  { language: 'zh', question_text: '网络不稳定' },
  { language: 'zh', question_text: '没有wifi' },
  { language: 'zh', question_text: 'wifi用不了' },
  { language: 'zh', question_text: '网络太慢了' },
  { language: 'zh', question_text: '连接不上网络' },
  { language: 'zh', question_text: 'wifi一直断' },
  { language: 'zh', question_text: '为什么wifi连不上' },
  { language: 'zh', question_text: '房间wifi信号不好' },
  { language: 'zh', question_text: '无线网络无法使用' },

  // ── 일본어 (ja) ── て형/ます형 혼용 ──────────────────────────────
  { language: 'ja', question_text: 'wifiが繋がらない' },
  { language: 'ja', question_text: 'wifiに繋がらない' },
  { language: 'ja', question_text: 'wifiが使えません' },
  { language: 'ja', question_text: 'wifiが使えない' },
  { language: 'ja', question_text: 'インターネットが繋がらない' },
  { language: 'ja', question_text: 'ネットが使えない' },
  { language: 'ja', question_text: 'wifi接続できない' },
  { language: 'ja', question_text: 'wifi接続が切れた' },
  { language: 'ja', question_text: 'wifiのパスワードが合わない' },
  { language: 'ja', question_text: 'パスワードが違う' },
  { language: 'ja', question_text: '電波が弱い' },
  { language: 'ja', question_text: '電波が悪い' },
  { language: 'ja', question_text: 'wifiが遅い' },
  { language: 'ja', question_text: 'インターネットが遅い' },
  { language: 'ja', question_text: 'wifiが切れる' },
  { language: 'ja', question_text: 'wifiが不安定' },
  { language: 'ja', question_text: 'どうやってwifiに繋ぐ' },
  { language: 'ja', question_text: 'wifiの接続方法を教えてください' },
  { language: 'ja', question_text: 'ネットが遅い' },
  { language: 'ja', question_text: 'インターネットが使えません' },
  { language: 'ja', question_text: 'wifiに接続できません' },
  { language: 'ja', question_text: 'wifi繋がらない' },
  { language: 'ja', question_text: 'wifiが途切れる' },
  { language: 'ja', question_text: 'ネット繋がらない' },
  { language: 'ja', question_text: 'wifiが弱い' },
  { language: 'ja', question_text: 'インターネット繋がらない' },
  { language: 'ja', question_text: 'wifiエラー' },
  { language: 'ja', question_text: 'ネットワーク繋がらない' },
  { language: 'ja', question_text: 'wifiパスワード間違い' },
  { language: 'ja', question_text: 'インターネット接続できない' },

  // ── 러시아어 (ru) ── падежи(격변화) 대응 ─────────────────────────
  { language: 'ru', question_text: 'wifi не работает' },
  { language: 'ru', question_text: 'вайфай не работает' },
  { language: 'ru', question_text: 'не могу подключиться к wifi' },
  { language: 'ru', question_text: 'не могу подключиться к вайфай' },
  { language: 'ru', question_text: 'интернет не работает' },
  { language: 'ru', question_text: 'нет интернета' },
  { language: 'ru', question_text: 'wifi не подключается' },
  { language: 'ru', question_text: 'wifi не соединяется' },
  { language: 'ru', question_text: 'слабый сигнал wifi' },
  { language: 'ru', question_text: 'плохой сигнал wifi' },
  { language: 'ru', question_text: 'wifi медленный' },
  { language: 'ru', question_text: 'медленный интернет' },
  { language: 'ru', question_text: 'wifi отключился' },
  { language: 'ru', question_text: 'wifi отвалился' },
  { language: 'ru', question_text: 'пароль не подходит' },
  { language: 'ru', question_text: 'пароль от wifi не работает' },
  { language: 'ru', question_text: 'как подключиться к wifi' },
  { language: 'ru', question_text: 'как пользоваться wifi' },
  { language: 'ru', question_text: 'нет соединения с интернетом' },
  { language: 'ru', question_text: 'интернет не работает в комнате' },
  { language: 'ru', question_text: 'wifi постоянно отключается' },
  { language: 'ru', question_text: 'не работает интернет' },
  { language: 'ru', question_text: 'нет wifi' },
  { language: 'ru', question_text: 'проблемы с wifi' },
  { language: 'ru', question_text: 'проблемы с интернетом' },
  { language: 'ru', question_text: 'wifi плохо работает' },
  { language: 'ru', question_text: 'интернет слабый' },
  { language: 'ru', question_text: 'wifi не ловит' },
  { language: 'ru', question_text: 'не могу войти в wifi' },
  { language: 'ru', question_text: 'соединение с интернетом прерывается' },

  // ── 스페인어 (es) ── tuteo/usted 혼용 ─────────────────────────────
  { language: 'es', question_text: 'wifi no funciona' },
  { language: 'es', question_text: 'el wifi no funciona' },
  { language: 'es', question_text: 'no puedo conectar al wifi' },
  { language: 'es', question_text: 'no me puedo conectar al wifi' },
  { language: 'es', question_text: 'wifi no conecta' },
  { language: 'es', question_text: 'sin wifi' },
  { language: 'es', question_text: 'sin internet' },
  { language: 'es', question_text: 'internet no funciona' },
  { language: 'es', question_text: 'no hay internet' },
  { language: 'es', question_text: 'la señal wifi es débil' },
  { language: 'es', question_text: 'señal wifi mala' },
  { language: 'es', question_text: 'wifi lento' },
  { language: 'es', question_text: 'internet lento' },
  { language: 'es', question_text: 'wifi se desconecta' },
  { language: 'es', question_text: 'se cae el wifi' },
  { language: 'es', question_text: 'la contraseña del wifi no funciona' },
  { language: 'es', question_text: 'cómo me conecto al wifi' },
  { language: 'es', question_text: 'cómo usar el wifi' },
  { language: 'es', question_text: 'problemas con el wifi' },
  { language: 'es', question_text: 'no tengo internet' },
  { language: 'es', question_text: 'no funciona el internet' },
  { language: 'es', question_text: 'wifi muy lento' },
  { language: 'es', question_text: 'no hay señal wifi' },
  { language: 'es', question_text: 'wifi se corta' },
  { language: 'es', question_text: 'no puedo acceder a internet' },
  { language: 'es', question_text: 'internet no va' },
  { language: 'es', question_text: 'falla el wifi' },
  { language: 'es', question_text: 'el wifi falla' },
  { language: 'es', question_text: 'contraseña wifi incorrecta' },
  { language: 'es', question_text: 'no me conecta al wifi' },
];

async function run() {
  console.log(`[add_wifi_questions] intent_id: '${INTENT_ID}'`);
  console.log(`[add_wifi_questions] 삽입할 질문 수: ${NEW_QUESTIONS.length}개`);

  // intent 존재 확인
  const { data: intent, error: intentErr } = await supabase
    .from('intents')
    .select('id')
    .eq('id', INTENT_ID)
    .single();

  if (intentErr || !intent) {
    console.error(`[ERROR] intent '${INTENT_ID}' 를 찾을 수 없습니다:`, intentErr?.message);
    process.exit(1);
  }
  console.log(`[add_wifi_questions] intent 확인 완료: ${INTENT_ID}`);

  // 언어별 통계
  const langCount = {};
  for (const q of NEW_QUESTIONS) {
    langCount[q.language] = (langCount[q.language] || 0) + 1;
  }
  console.log('[add_wifi_questions] 언어별 질문 수:', langCount);

  // intent_id 필드 추가 후 삽입
  const rows = NEW_QUESTIONS.map((q) => ({ intent_id: INTENT_ID, ...q }));

  // 기존 질문 조회하여 중복 방지
  const { data: existing, error: fetchErr } = await supabase
    .from('intent_questions')
    .select('question_text')
    .eq('intent_id', INTENT_ID);

  if (fetchErr) {
    console.error('[ERROR] 기존 질문 조회 실패:', fetchErr.message);
    process.exit(1);
  }

  const existingSet = new Set((existing || []).map((r) => r.question_text));
  console.log(`[add_wifi_questions] 기존 질문 수: ${existingSet.size}개`);

  const newRows = rows.filter((r) => !existingSet.has(r.question_text));
  console.log(`[add_wifi_questions] 신규 삽입 대상: ${newRows.length}개`);

  if (newRows.length === 0) {
    console.log('[add_wifi_questions] 추가할 신규 질문 없음. 종료.');
    process.exit(0);
  }

  // 배치 삽입
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
    const { error } = await supabase.from('intent_questions').insert(batch);
    if (error) {
      console.error(`[ERROR] 배치 ${i}~${i + BATCH} 삽입 실패:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`[add_wifi_questions] 완료: ${inserted}개 신규 삽입됨`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
