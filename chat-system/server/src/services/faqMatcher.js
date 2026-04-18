const supabase = require('./supabase');

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0)
  );
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// 질문 문자열 안에 FAQ 키워드가 몇 개나 포함되는지로 점수 계산
function keywordScore(questionStr, keywords) {
  if (!keywords || keywords.length === 0) return 0;
  const qLower = questionStr.toLowerCase();
  const hits = keywords.filter((kw) => qLower.includes(kw.toLowerCase())).length;
  if (hits === 0) return 0;
  if (hits >= 2) return 0.92;
  return 0.82;
}

async function loadFaqs() {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return data || [];
}

// 임계값 분기: ≥0.8 자동응답 / 0.5~0.8 후보 / <0.5 escalate
async function match(question) {
  const faqs = await loadFaqs();
  if (faqs.length === 0) return { type: 'escalate' };

  const qTokens = tokenize(question);

  const scored = faqs.map((faq) => {
    const fTokens = tokenize(faq.question);
    const wordScore = jaccard(qTokens, fTokens);
    const kwScore = keywordScore(question, faq.keywords);
    return { faq, score: Math.max(wordScore, kwScore) };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (best.score >= 0.8) {
    return { type: 'auto', faq: best.faq, confidence: best.score };
  } else if (best.score >= 0.5) {
    const candidates = scored
      .filter((s) => s.score >= 0.5)
      .slice(0, 3)
      .map((s) => ({ question: s.faq.question, answer: s.faq.answer, score: s.score }));
    return { type: 'candidates', candidates, confidence: best.score };
  } else {
    return { type: 'escalate', confidence: best.score };
  }
}

module.exports = { match };
