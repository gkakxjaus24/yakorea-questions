// ============================================================
// 구글 앱스 스크립트 — 키오스크 체크인 현황 시트 연동
//
// 컬럼 구조:
//   A: 예약번호
//   B: 이름
//   C: 방 번호
//   D: 입실 날짜  ← 신규 추가
//   E: 퇴실 날짜  ← 기존 D열에서 이동
//   F: 체크인 시간 ← 기존 E열에서 이동
//
// 배포 방법:
//   Apps Script 편집기 → 배포 → 웹 앱으로 배포
//   (실행 계정: 나, 액세스 권한: 모든 사용자)
// ============================================================

// ⚠️ 실제 시트 탭 이름으로 변경하세요
const SHEET_NAME = "체크인확인";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === "sync") {
      return syncReservations(payload.data);
    } else if (action === "checkin") {
      return recordCheckIn(payload.resNum);
    } else {
      return jsonResponse({ status: "error", message: "unknown action" });
    }
  } catch (err) {
    return jsonResponse({ status: "error", message: err.message });
  }
}

/** sync: 오늘 입실 손님만 A~E열에 기록, 기존 체크인시간(F열)은 예약번호 기준으로 자동 복원 */
function syncReservations(dataArray) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  // 1) 기존 시트에서 체크인 시간(F열) 백업 (예약번호 → 시간)
  const savedTimes = {};
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const existing = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    existing.forEach(row => {
      // 문자열 타입(HH:mm)인 경우만 저장 — 숫자(날짜 시리얼)는 제외
      if (row[0] && row[5] && typeof row[5] === "string") savedTimes[String(row[0]).trim()] = row[5];
    });
  }

  // 2) 기존 데이터 전체 삭제 (A~F)
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 6).clearContent();
  }

  if (!dataArray || dataArray.length === 0) {
    return jsonResponse({ status: "ok", message: "오늘 입실 손님 없음" });
  }

  // 3) 입실날짜 내림차순으로 dataArray 자체를 정렬 (최신 날짜 상단)
  //    rows를 따로 정렬하면 복원 루프(4번)의 인덱스와 순서가 어긋나므로
  //    반드시 dataArray를 먼저 정렬한 뒤 rows를 만들어야 합니다.
  const toMs = str => {
    if (!str) return 0;
    const [d, m, y] = str.split("/");
    return new Date(y, m - 1, d).getTime();
  };
  dataArray.sort((a, b) => toMs(b.checkin_date) - toMs(a.checkin_date));

  const rows = dataArray.map(item => [
    item.resNum      || "",           // A: 예약번호
    item.name        || "",           // B: 이름
    item.room        || "",           // C: 방 번호
    formatDate(item.checkin_date),    // D: 입실 날짜
    formatDate(item.checkout)         // E: 퇴실 날짜
  ]);
  sheet.getRange(2, 1, rows.length, 5).setValues(rows);

  // 4) 이미 체크인한 손님의 시간 복원 (F열) — dataArray와 rows가 같은 순서이므로 인덱스 일치
  dataArray.forEach((item, idx) => {
    const saved = savedTimes[String(item.resNum).trim()];
    if (saved) sheet.getRange(idx + 2, 6).setValue(saved);
  });

  return jsonResponse({ status: "ok", count: rows.length });
}

/** checkin: 예약번호로 행을 찾아 F열에 체크인 시간 기록 */
function recordCheckIn(resNum) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) { // 1행 = 헤더 건너뜀
    if (String(data[i][0]).trim().toUpperCase() === String(resNum).trim().toUpperCase()) {
      const now = new Date();
      const timeStr = Utilities.formatDate(now, "Asia/Seoul", "HH:mm");
      sheet.getRange(i + 1, 6).setValue(timeStr); // F열 = 컬럼 인덱스 6
      return jsonResponse({ status: "ok", row: i + 1, time: timeStr });
    }
  }

  return jsonResponse({ status: "not_found", resNum: resNum });
}

/** 기존 예약 데이터 초기화 — A~E열만 지우고 F열(체크인시간)은 보존 */
function clearOldReservations(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // 헤더만 있으면 스킵
  sheet.getRange(2, 1, lastRow - 1, 5).clearContent(); // A~E열만 지움
}

/**
 * 날짜 정규화 — 엑셀 숫자 시리얼과 문자열 모두 처리
 * Cloudbeds 엑셀에서 날짜가 숫자(시리얼)로 올 수도 있고 문자열로 올 수도 있음
 */
function formatDate(value) {
  if (!value) return "";
  if (typeof value === "number") {
    // 엑셀 날짜 시리얼 → Date 변환 (1900년 기준)
    const date = new Date((value - 25569) * 86400 * 1000);
    return Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd");
  }
  return String(value).trim();
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
