// 키오스크 다국어 JSON 파일에 ru/es/mn 키 자동 추가 (Claude Haiku 4.5 번역)
//
// 대상: C:/Project_Claude/data/*.json — 각 파일은 { ko, en, zh, ja } 구조.
// 영어(en)를 소스로 ru, es, mn 번역 객체를 생성하여 추가 후 같은 파일에 저장.
//
// 안전:
//  - 이미 언어 키가 있으면 스킵 (덮어쓰지 않음)
//  - 번역 실패 시 해당 언어 스킵, 다음 파일로 진행
//  - 호스텔 도메인 힌트 시스템 프롬프트에 포함

require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 없음'); process.exit(1); }
const client = new Anthropic({ apiKey: KEY });

// DATA_DIR / FILES 모두 env로 오버라이드 가능 — 같은 스크립트로 yakorea-questions 등 다른 폴더 번역에 재사용.
//   예: $env:I18N_DATA_DIR="C:/.../yakorea-questions/data"; $env:I18N_FILES="QnA.json"; node ...
const DATA_DIR = process.env.I18N_DATA_DIR
  ? path.resolve(process.env.I18N_DATA_DIR)
  : path.resolve(__dirname, '../../../data');
const FILES = process.env.I18N_FILES
  ? process.env.I18N_FILES.split(',').map(s => s.trim()).filter(Boolean)
  : [
      'QnA.json',
      'checkin_out_selection.json',
      'cleaning_time.json',
      'no_check_out.json',
      'reception_closed.json',
      'reservation_number.json',
      'self_check_in.json',
    ];
console.log(`[i18n] DATA_DIR=${DATA_DIR}`);
console.log(`[i18n] FILES=${FILES.join(', ')}`);

const LANG_NAME = {
  ru: 'Russian (Русский)',
  es: 'Spanish (Español)',
  mn: 'Mongolian (Монгол хэл, Cyrillic script)',
  vi: 'Vietnamese (Tiếng Việt, Latin script with diacritics)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
};

function buildSystemPrompt(targetLang) {
  return [
    `You translate Yakorea Hostel's kiosk UI text from English to ${LANG_NAME[targetLang]}.`,
    ``,
    `STRICT RULES:`,
    `1. Output ONLY valid JSON — exact same structure and keys as input. No markdown fences, no commentary.`,
    `2. Translate string values only. Keep keys, numbers, booleans, HTML tags (<br>, <b>, etc.), and emojis exactly.`,
    `3. Preserve placeholders like {name}, {roomLabel}, ?lang= in URLs unchanged.`,
    `4. Preserve room labels (B1, 201, 202...), times (3:00 PM), prices, phone numbers exactly.`,
    `5. Preserve proper nouns: Yakorea, Seoul.`,
    `6. Keep the tone friendly and clear — kiosk users may be tired travelers.`,
    `7. If a string mixes languages, keep the non-English parts as-is and only translate English parts.`,
  ].join('\n');
}

async function translateObject(sourceObj, targetLang) {
  const sys = buildSystemPrompt(targetLang);
  const userMsg = `Translate this JSON to ${LANG_NAME[targetLang]}. Output only the translated JSON object:\n\n${JSON.stringify(sourceObj, null, 2)}`;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 8000,
    system: [
      { type: 'text', text: sys, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMsg }],
  });

  let text = (resp.content?.[0]?.text || '').trim();
  // 혹시 코드펜스 감싸졌으면 제거
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}

(async () => {
  let okFiles = 0, skipFiles = 0, errFiles = 0;
  for (const fname of FILES) {
    const fpath = path.join(DATA_DIR, fname);
    if (!fs.existsSync(fpath)) {
      console.warn(`⚠ ${fname} 없음 — 건너뜀`);
      skipFiles++;
      continue;
    }
    const data = JSON.parse(fs.readFileSync(fpath, 'utf8'));
    const source = data.en || data.ko;
    if (!source) {
      console.error(`✗ ${fname}: en/ko 모두 없음`);
      errFiles++;
      continue;
    }

    let changed = false;
    for (const lang of ['ru', 'es', 'mn', 'vi', 'fr', 'de']) {
      if (data[lang]) {
        console.log(`  - ${fname}/${lang}: 이미 존재, 건너뜀`);
        continue;
      }
      try {
        console.log(`  - ${fname}/${lang}: 번역 중...`);
        const t0 = Date.now();
        const translated = await translateObject(source, lang);
        const ms = Date.now() - t0;
        data[lang] = translated;
        changed = true;
        console.log(`    ✓ ${ms}ms`);
      } catch (e) {
        console.error(`    ✗ 번역 실패: ${e.message}`);
        errFiles++;
      }
    }

    if (changed) {
      fs.writeFileSync(fpath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      okFiles++;
      console.log(`  ✓ ${fname} 저장됨`);
    } else {
      skipFiles++;
    }
  }
  console.log(`\n완료: 저장 ${okFiles}, 변경없음 ${skipFiles}, 실패 ${errFiles}`);
})();
