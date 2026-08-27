/* QR 사이트용 최소 설정.
   키오스크의 js/config.js를 통째로 복사하지 않는다 — 예약 조회 API 등
   손님 휴대폰에 내려갈 이유가 없는 설정까지 딸려오기 때문이다.
   늦은 체크아웃 신청에 필요한 것은 이 URL 하나뿐이다.

   ⚠️ 키오스크 쪽 config.js에서 CHECKIN_SCRIPT_URL이 바뀌면 여기도 바꿔야 한다
   (Apps Script를 "새 버전"으로 배포하면 /exec URL은 그대로라 보통 바뀌지 않는다). */
const CONFIG = {
  CHECKIN_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxD3yE3QrXj5TCQBI8bllavvLzASMNa6FugeOVJTxs9b2_8W-CJOhtxveYq5SCmDcPt/exec",
};
