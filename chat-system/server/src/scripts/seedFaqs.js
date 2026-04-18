require('dotenv').config();
const supabase = require('../services/supabase');

const faqs = [
  {
    question: '체크인 시간이 언제인가요',
    answer: '체크인은 오후 3시(15:00)부터 가능합니다.',
    keywords: ['체크인', '입실', '시간', 'check-in', 'checkin'],
  },
  {
    question: '체크아웃 시간이 언제인가요',
    answer: '체크아웃은 오전 11시(11:00)까지입니다.',
    keywords: ['체크아웃', '퇴실', '시간', 'check-out', 'checkout'],
  },
  {
    question: '와이파이 비밀번호가 무엇인가요',
    answer: '프론트 데스크에 문의해 주시면 안내해 드리겠습니다.',
    keywords: ['와이파이', 'wifi', '비밀번호', '인터넷', 'password'],
  },
  {
    question: '주차 가능한가요',
    answer: '죄송합니다, 별도의 주차 공간은 없습니다. 근처 공영 주차장을 이용하시기 바랍니다.',
    keywords: ['주차', '차', '주차장', 'parking'],
  },
  {
    question: '짐을 맡길 수 있나요',
    answer: '체크인 전이나 체크아웃 후 짐 보관 서비스를 제공합니다.',
    keywords: ['짐', '보관', '맡기다', 'luggage', 'storage', '가방'],
  },
  {
    question: '조식이 제공되나요',
    answer: '조식은 제공되지 않습니다. 근처에 다양한 식당과 카페가 있습니다.',
    keywords: ['조식', '아침', '식사', 'breakfast', '밥'],
  },
  {
    question: '근처 관광지가 어디인가요',
    answer: '근처에 경복궁, 북촌한옥마을, 인사동 등이 있습니다. 더 자세한 안내는 프론트에 문의해 주세요.',
    keywords: ['관광', '명소', '볼거리', '여행', 'tourist', 'attraction'],
  },
  {
    question: '환불 정책이 어떻게 되나요',
    answer: '체크인 72시간 전 취소 시 전액 환불, 그 이후는 부분 환불 또는 환불 불가입니다.',
    keywords: ['환불', '취소', '정책', 'refund', 'cancel'],
  },
  {
    question: '수건이나 침구를 교체해 주실 수 있나요',
    answer: '3박 이상 숙박 시 침구 교체 서비스를 제공합니다. 수건은 요청 시 교체 가능합니다.',
    keywords: ['수건', '침구', '교체', '청소', 'towel', 'linen', 'housekeeping'],
  },
  {
    question: '흡연이 가능한가요',
    answer: '건물 내부는 전체 금연입니다. 지정된 외부 흡연 구역을 이용해 주세요.',
    keywords: ['흡연', '담배', '금연', 'smoking', 'cigarette'],
  },
];

async function seed() {
  console.log('FAQ 시드 데이터 삽입 중...');
  const { error } = await supabase.from('faqs').insert(faqs);
  if (error) {
    console.error('삽입 실패:', error.message);
    process.exit(1);
  }
  console.log(`✅ ${faqs.length}개 FAQ 삽입 완료`);
  process.exit(0);
}

seed();
