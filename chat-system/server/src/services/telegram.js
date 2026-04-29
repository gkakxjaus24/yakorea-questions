const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// 콤마로 여러 chat_id 지원 (사장님 + 직원 + …)
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ADMIN_URL = process.env.ADMIN_URL || 'https://yakorea-chat-admin.vercel.app';

function sendOne(chatId, text) {
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
  const req = https.request(
    {
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    (res) => {
      if (res.statusCode !== 200) {
        console.error(`[Telegram] chat_id=${chatId} 전송 실패: HTTP ${res.statusCode}`);
      }
    }
  );
  req.on('error', (e) => console.error(`[Telegram] chat_id=${chatId} 오류:`, e.message));
  req.write(body);
  req.end();
}

function sendMessage(text) {
  if (!TOKEN || CHAT_IDS.length === 0) return; // 환경변수 없으면 조용히 건너뜀
  for (const id of CHAT_IDS) sendOne(id, text);
}

function alertEscalation(roomId, roomLabel, guestName) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const time = kst.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const link = `${ADMIN_URL}/chat/${roomId}`;
  const roomInfo = roomLabel ? `🚪 <b>${roomLabel}호</b>` : '';
  const nameInfo = guestName ? `👤 <b>${guestName}</b>` : '';
  const detail = [roomInfo, nameInfo].filter(Boolean).join('  ');
  sendMessage(
    `🔔 <b>손님 연결 요청</b>\n\n${detail ? detail + '\n' : ''}매니저 연결을 요청했습니다.\n🕐 ${time} (KST)\n\n👉 <a href="${link}">채팅방 바로가기</a>`
  );
}

module.exports = { alertEscalation };
