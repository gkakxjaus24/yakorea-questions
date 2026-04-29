// "Talk to person 입력" 안내 → "아래 [매니저 연결] 버튼" 안내로 일괄 수정
//
// 영향 받는 4개 intent × 6개 언어 = 24건.
// 위젯이 requiresHandoff=true 시 자동으로 escalate 버튼을 노출하므로,
// 답변 텍스트는 그 버튼을 가리키도록 자연스럽게 다시 작성.

require('dotenv').config({ override: true });
const supabase = require('./../src/services/supabase');

// 언어별 "매니저 연결 버튼" 표기 (위젯의 escalateBtn 라벨과 동일하게)
const BTN_LABEL = {
  ko: '👤 매니저와 연결하기',
  en: '👤 Connect to manager',
  zh: '👤 联系客服',
  ja: '👤 スタッフに連絡',
  ru: '👤 Связаться с менеджером',
  es: '👤 Conectar con gerente',
};

// 4개 intent × 6개 언어 새 답변
const ANSWERS = {
  staff_connect: {
    ko: `아래의 [${BTN_LABEL.ko}] 버튼을 눌러 직원과 연결할 수 있습니다.`,
    en: `Tap the [${BTN_LABEL.en}] button below to reach our staff.`,
    zh: `点击下方 [${BTN_LABEL.zh}] 按钮即可联系工作人员。`,
    ja: `下の [${BTN_LABEL.ja}] ボタンを押すとスタッフにつながります。`,
    ru: `Нажмите кнопку [${BTN_LABEL.ru}] ниже, чтобы связаться с сотрудником.`,
    es: `Pulse el botón [${BTN_LABEL.es}] abajo para hablar con el personal.`,
  },
  bed_issue: {
    ko: `다른 손님이나 짐이 침대에 있다면 침대 번호를 잘못 보셨을 수 있습니다. 직원 확인이 필요합니다 — 아래 [${BTN_LABEL.ko}] 버튼을 눌러주세요.`,
    en: `If someone or something is on your bed, you may have the wrong bed number. Staff needs to verify — please tap the [${BTN_LABEL.en}] button below.`,
    zh: `如果您的床位上有他人或物品，可能是床位号弄错了。需要员工确认 — 请点击下方 [${BTN_LABEL.zh}] 按钮。`,
    ja: `自分のベッドに他の人や荷物がある場合、ベッド番号を間違えている可能性があります。スタッフによる確認が必要です — 下の [${BTN_LABEL.ja}] ボタンを押してください。`,
    ru: `Если на вашей кровати кто-то или чьи-то вещи, возможно, вы перепутали номер кровати. Требуется проверка сотрудником — нажмите кнопку [${BTN_LABEL.ru}] ниже.`,
    es: `Si hay otra persona u objeto en su cama, puede haber confundido el número. Se requiere verificación del personal — pulse el botón [${BTN_LABEL.es}] abajo.`,
  },
  noise_complaint: {
    ko: `소음 문제는 직원이 직접 확인해야 합니다. 아래 [${BTN_LABEL.ko}] 버튼을 눌러 직원에게 알려주세요.`,
    en: `Noise issues need to be checked directly by staff. Please tap the [${BTN_LABEL.en}] button below.`,
    zh: `噪音问题需要员工直接处理。请点击下方 [${BTN_LABEL.zh}] 按钮告知员工。`,
    ja: `騒音問題はスタッフが直接確認する必要があります。下の [${BTN_LABEL.ja}] ボタンを押してお知らせください。`,
    ru: `Проблемы с шумом должен проверять сотрудник. Нажмите кнопку [${BTN_LABEL.ru}] ниже.`,
    es: `Los problemas de ruido requieren verificación directa del personal. Pulse el botón [${BTN_LABEL.es}] abajo.`,
  },
  room_complaint: {
    ko: `침구 냄새, 난방, 화장지 부족, 에어컨 등 객실 불편 사항은 직원 확인이 필요합니다. 아래 [${BTN_LABEL.ko}] 버튼을 눌러주세요.`,
    en: `Issues like bedding odor, heating, lack of toilet paper, or AC need staff verification. Please tap the [${BTN_LABEL.en}] button below.`,
    zh: `床品气味、暖气、卫生纸不足、空调等房间问题需要员工确认。请点击下方 [${BTN_LABEL.zh}] 按钮。`,
    ja: `寝具のにおい、暖房、トイレットペーパー不足、エアコンなど客室のご不便はスタッフによる確認が必要です。下の [${BTN_LABEL.ja}] ボタンを押してください。`,
    ru: `Такие вопросы как запах постельного белья, отопление, нехватка туалетной бумаги, кондиционер — требуют проверки сотрудника. Нажмите кнопку [${BTN_LABEL.ru}] ниже.`,
    es: `Problemas como olor de la ropa de cama, calefacción, falta de papel higiénico o aire acondicionado requieren verificación del personal. Pulse el botón [${BTN_LABEL.es}] abajo.`,
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
      if (error) {
        console.error(`✗ ${intentId}/${lang}:`, error.message);
      } else {
        updated++;
        console.log(`✓ ${intentId}/${lang}`);
      }
    }
  }
  console.log(`\n총 ${updated}건 업데이트 완료.`);
})();
