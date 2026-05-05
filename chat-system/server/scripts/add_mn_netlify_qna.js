// yakorea-questions/data/QnA.json 에 mn 블록 추가
// 키오스크 data/QnA.json의 mn 데이터 + en keyword 번역으로 구성
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 없음'); process.exit(1); }
const client = new Anthropic({ apiKey: KEY });

const ROOT = path.resolve(__dirname, '../../../');
const KIOSK_QNA = path.join(ROOT, 'data/QnA.json');
const NETLIFY_QNA = path.join(ROOT, 'yakorea-questions/data/QnA.json');

async function run() {
  const kiosk = JSON.parse(fs.readFileSync(KIOSK_QNA, 'utf8'));
  const netlify = JSON.parse(fs.readFileSync(NETLIFY_QNA, 'utf8'));

  if (netlify.mn) {
    console.log('mn 블록 이미 존재 — 건너뜀');
    process.exit(0);
  }

  // kiosk mn has 23 items; netlify en has 22.
  // The extra kiosk item is "forgot room password" (index 20 in kiosk).
  // Map kiosk mn → netlify en by matching questions.
  const netlifyEnItems = netlify.en.qna;
  const kioskMnItems = kiosk.mn.qna;

  // Build keyword translation prompt: en keywords → Mongolian substrings
  // We know the Mongolian questions already, so ask Haiku for the best matching substring
  const pairs = netlifyEnItems.map((enItem, i) => {
    // Find corresponding kiosk mn item (skip index 20 "forgot password" in kiosk mn)
    const kioskIdx = i < 20 ? i : i + 1;
    const mnItem = kioskMnItems[kioskIdx];
    return {
      enKeyword: enItem.keyword,
      mnQuestion: mnItem ? mnItem.q : '',
      mnAnswer: mnItem ? mnItem.a : '',
      category: mnItem ? mnItem.category : enItem.category,
    };
  });

  // Ask Haiku to find the best keyword substring for each mn question
  const prompt = pairs.map((p, i) =>
    `${i + 1}. English keyword: "${p.enKeyword}"\n   Mongolian question: "${p.mnQuestion}"`
  ).join('\n');

  console.log('Haiku로 몽골어 키워드 생성 중...');
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `For each item below, find the shortest natural Mongolian keyword that:
1. Is an exact substring of the Mongolian question
2. Semantically matches the English keyword
3. Is typically 1-3 words

Output ONLY the numbered keywords, one per line. No extra text.

${prompt}`,
    }],
  });

  const lines = resp.content[0].text.trim().split('\n').filter(l => l.trim());
  const keywords = lines.map(l => l.replace(/^\d+\.\s*/, '').trim().replace(/^["']|["']$/g, ''));

  // Build mn qna array
  const mnQna = pairs.map((p, i) => {
    const rawKw = keywords[i] || '';
    // Verify keyword is actually in the question; if not, use empty string
    const keyword = p.mnQuestion.includes(rawKw) ? rawKw : '';
    return {
      q: p.mnQuestion,
      keyword,
      a: p.mnAnswer,
      category: p.category,
    };
  });

  netlify.mn = {
    title: kiosk.mn.title,
    qna: mnQna,
  };

  fs.writeFileSync(NETLIFY_QNA, JSON.stringify(netlify, null, 2) + '\n', 'utf8');
  console.log(`✓ mn 블록 추가 완료 (${mnQna.length}개 QnA)`);

  // Verify keywords
  let kwHit = 0;
  mnQna.forEach((item, i) => {
    if (item.keyword) kwHit++;
    else console.log(`  키워드 없음 [${i}]: ${item.q.substring(0, 40)}`);
  });
  console.log(`  → 키워드 매칭: ${kwHit}/${mnQna.length}`);
}

run().catch(e => { console.error(e); process.exit(1); });
