// 카운터 전화 번호 + 안내 문구 일괄 수정
//  - settings.contact_phone → 010-5747-1294
//  - intent_answers.contact_info 6개 언어 → "카운터 전화로만 응대" 명시 문구
//
// 배경: 손님이 본인 휴대폰으로 직원 휴대폰에 거는 게 아니라, 호스텔 카운터에 있는
// 전화기로 호스텔 운영 번호 010-5747-1294에 걸어야 응대됨.

require('dotenv').config({ override: true });
const supabase = require('./../src/services/supabase');

const NEW_PHONE = '010-5747-1294';

const ANSWERS = {
  ko: `급한 문의는 1층 카운터 전화기로 ${NEW_PHONE}에 걸어주세요.\n(카운터 전화만 응답됩니다. 개인 휴대폰은 받지 않습니다.)`,
  en: `For urgent matters, please call ${NEW_PHONE} from the front desk phone on the 1st floor.\n(Only front desk calls are answered. Personal mobile calls are not accepted.)`,
  zh: `如有紧急事宜，请使用1楼前台电话拨打 ${NEW_PHONE}。\n(仅接听前台电话。个人手机来电不接听。)`,
  ja: `緊急のご用件は、1階フロントの電話から ${NEW_PHONE} におかけください。\n(フロントからのお電話のみ対応いたします。個人の携帯電話は受け付けておりません。)`,
  ru: `По срочным вопросам звоните на ${NEW_PHONE} с телефона стойки регистрации (1 этаж).\n(Отвечаем только на звонки со стойки регистрации. Звонки с личных мобильных не принимаются.)`,
  es: `Para asuntos urgentes, llame al ${NEW_PHONE} desde el teléfono de recepción (planta 1).\n(Solo se atienden llamadas desde recepción. No se atienden llamadas desde móviles personales.)`,
};

(async () => {
  // 1) settings.contact_phone 갱신
  const { error: sErr } = await supabase
    .from('settings')
    .update({ value: NEW_PHONE })
    .eq('key', 'contact_phone');
  if (sErr) { console.error('✗ settings 갱신 실패:', sErr.message); }
  else { console.log(`✓ settings.contact_phone = ${NEW_PHONE}`); }

  // 2) contact_info 답변 6개 언어 갱신
  let ok = 0;
  for (const [lang, text] of Object.entries(ANSWERS)) {
    const { error } = await supabase
      .from('intent_answers')
      .update({ answer_template: text, updated_at: new Date().toISOString() })
      .eq('intent_id', 'contact_info')
      .eq('language', lang);
    if (error) { console.error(`✗ contact_info/${lang}:`, error.message); }
    else { ok++; console.log(`✓ contact_info/${lang}`); }
  }
  console.log(`\n총 ${ok}/6 답변 갱신 완료.`);
})();
