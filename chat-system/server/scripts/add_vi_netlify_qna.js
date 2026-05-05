// yakorea-questions/data/QnA.json 에 vi 블록 추가
require('dotenv').config({ override: true });
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 없음'); process.exit(1); }
const client = new Anthropic({ apiKey: KEY });

const KIOSK_QNA = 'C:/Project_Claude/data/QnA.json';
const NETLIFY_QNA = 'C:/Project_Claude/yakorea-questions/data/QnA.json';

async function run() {
  const kiosk = JSON.parse(fs.readFileSync(KIOSK_QNA, 'utf8'));
  const netlify = JSON.parse(fs.readFileSync(NETLIFY_QNA, 'utf8'));

  if (netlify.vi) {
    console.log('vi 블록 이미 존재 — 건너뜀');
    process.exit(0);
  }

  const netlifyEnItems = netlify.en.qna;
  const kioskViItems = kiosk.vi.qna;

  // kiosk vi has 23 items; netlify needs 22 (skip index 20 = forgot password)
  const pairs = netlifyEnItems.map((enItem, i) => {
    const kioskIdx = i < 20 ? i : i + 1;
    const viItem = kioskViItems[kioskIdx];
    return {
      enKeyword: enItem.keyword,
      viQ: viItem ? viItem.q : '',
      viA: viItem ? viItem.a : '',
      category: viItem ? viItem.category : enItem.category,
    };
  });

  const prompt = pairs.map((p, i) =>
    `${i + 1}. English keyword: "${p.enKeyword}"\n   Vietnamese question: "${p.viQ}"`
  ).join('\n');

  console.log('Haiku로 베트남어 키워드 생성 중...');
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `For each item, find the shortest Vietnamese keyword that:
1. Is an exact substring of the Vietnamese question
2. Semantically matches the English keyword
3. Is typically 1-3 words

Output ONLY the numbered keywords, one per line. No extra text.

${prompt}`,
    }],
  });

  const lines = resp.content[0].text.trim().split('\n').filter(l => l.trim());
  const keywords = lines.map(l => l.replace(/^\d+\.\s*/, '').trim().replace(/^["']|["']$/g, ''));

  const viQna = pairs.map((p, i) => {
    const rawKw = keywords[i] || '';
    const keyword = p.viQ.includes(rawKw) ? rawKw : '';
    return { q: p.viQ, keyword, a: p.viA, category: p.category };
  });

  netlify.vi = { title: kiosk.vi.title, qna: viQna };
  fs.writeFileSync(NETLIFY_QNA, JSON.stringify(netlify, null, 2) + '\n', 'utf8');

  const kwHit = viQna.filter(item => item.keyword).length;
  console.log(`✓ vi 블록 추가 완료 (${viQna.length}개 QnA, 키워드 ${kwHit}/${viQna.length} 매칭)`);
  viQna.forEach((item, i) => {
    if (!item.keyword) console.log(`  키워드 없음 [${i}]: ${item.q.substring(0, 50)}`);
  });
}

run().catch(e => { console.error(e); process.exit(1); });
