// 직원 확인 필요 4개 intent의 답변 텍스트를 '타이핑 안내'로 일괄 수정
//
// 배경: '아래 [버튼] 누르세요' 안내가 박혀 있었지만, 일부 환경(캐시, 모드 등)에서
// 버튼이 안 보이는 케이스 발견. 어떤 상황에서든 손님이 매니저와 연결될 수 있도록
// '직원 연결이라고 타이핑해주세요' 식으로 명확한 우회 안내로 변경.
//
// 입력 키워드는 isEscalationRequest()가 잡는 표현으로 정함 (ko: '직원 연결',
// en: 'Talk to staff', zh: '联系客服', ja: 'スタッフに連絡', ...)

require('dotenv').config({ override: true });
const supabase = require('./../src/services/supabase');

// 각 언어별 입력 안내 키워드
const TYPE_PHRASE = {
  ko: '직원 연결',
  en: 'Talk to staff',
  zh: '联系客服',
  ja: 'スタッフに連絡',
  ru: 'Связаться с менеджером',
  es: 'Hablar con personal',
};

const ANSWERS = {
  staff_connect: {
    ko: `직원과 연결을 원하시면 메시지 창에 "${TYPE_PHRASE.ko}"이라고 입력해 주세요.`,
    en: `To reach our staff, please type "${TYPE_PHRASE.en}" in the message box.`,
    zh: `如需联系工作人员，请在消息框中输入 "${TYPE_PHRASE.zh}"。`,
    ja: `スタッフにつなげたい場合は、メッセージ欄に「${TYPE_PHRASE.ja}」と入力してください。`,
    ru: `Чтобы связаться с сотрудником, введите «${TYPE_PHRASE.ru}» в окне сообщений.`,
    es: `Para hablar con el personal, escriba "${TYPE_PHRASE.es}" en el cuadro de mensajes.`,
  },
  bed_issue: {
    ko: `다른 손님이나 짐이 침대에 있다면 침대 번호를 잘못 보셨을 수 있습니다. 직원 확인이 필요하니 메시지 창에 "${TYPE_PHRASE.ko}"이라고 입력해 주세요.`,
    en: `If someone or something is on your bed, you may have the wrong bed number. Staff needs to verify — please type "${TYPE_PHRASE.en}" in the message box.`,
    zh: `如果您的床位上有他人或物品，可能是床位号弄错了。需要员工确认 — 请在消息框中输入 "${TYPE_PHRASE.zh}"。`,
    ja: `自分のベッドに他の人や荷物がある場合、ベッド番号を間違えている可能性があります。スタッフによる確認が必要ですので、メッセージ欄に「${TYPE_PHRASE.ja}」と入力してください。`,
    ru: `Если на вашей кровати кто-то или чьи-то вещи, возможно, вы перепутали номер кровати. Требуется проверка сотрудником — введите «${TYPE_PHRASE.ru}» в окне сообщений.`,
    es: `Si hay otra persona u objeto en su cama, puede haber confundido el número. Se requiere verificación del personal — escriba "${TYPE_PHRASE.es}" en el cuadro de mensajes.`,
  },
  noise_complaint: {
    ko: `소음 문제는 직원이 직접 확인해야 합니다. 메시지 창에 "${TYPE_PHRASE.ko}"이라고 입력해 직원에게 알려 주세요.`,
    en: `Noise issues need to be checked directly by staff. Please type "${TYPE_PHRASE.en}" in the message box.`,
    zh: `噪音问题需要员工直接处理。请在消息框中输入 "${TYPE_PHRASE.zh}" 告知员工。`,
    ja: `騒音問題はスタッフが直接確認する必要があります。メッセージ欄に「${TYPE_PHRASE.ja}」と入力してお知らせください。`,
    ru: `Проблемы с шумом должен проверять сотрудник. Введите «${TYPE_PHRASE.ru}» в окне сообщений.`,
    es: `Los problemas de ruido requieren verificación directa del personal. Escriba "${TYPE_PHRASE.es}" en el cuadro de mensajes.`,
  },
  room_complaint: {
    ko: `침구 냄새, 난방, 화장지 부족, 에어컨 등 객실 불편 사항은 직원 확인이 필요합니다. 메시지 창에 "${TYPE_PHRASE.ko}"이라고 입력해 주세요.`,
    en: `Issues like bedding odor, heating, lack of toilet paper, or AC need staff verification. Please type "${TYPE_PHRASE.en}" in the message box.`,
    zh: `床品气味、暖气、卫生纸不足、空调等房间问题需要员工确认。请在消息框中输入 "${TYPE_PHRASE.zh}"。`,
    ja: `寝具のにおい、暖房、トイレットペーパー不足、エアコンなど客室のご不便はスタッフによる確認が必要です。メッセージ欄に「${TYPE_PHRASE.ja}」と入力してください。`,
    ru: `Такие вопросы как запах постельного белья, отопление, нехватка туалетной бумаги, кондиционер — требуют проверки сотрудника. Введите «${TYPE_PHRASE.ru}» в окне сообщений.`,
    es: `Problemas como olor de la ropa de cama, calefacción, falta de papel higiénico o aire acondicionado requieren verificación del personal. Escriba "${TYPE_PHRASE.es}" en el cuadro de mensajes.`,
  },
};

(async () => {
  let updated = 0;
  for (const [intentId, langs] of Object.entries(ANSWERS)) {
    for (const [lang, text] of Object.entries(langs)) {
      const { error } = await supabase
        .from('intent_answers')
        .update({ answer_template: text, updated_at: new Date().toISOString() })
        .eq('intent_id', intentId)
        .eq('language', lang);
      if (error) console.error(`✗ ${intentId}/${lang}:`, error.message);
      else { updated++; console.log(`✓ ${intentId}/${lang}`); }
    }
  }
  console.log(`\n총 ${updated}건 업데이트 완료.`);
})();
