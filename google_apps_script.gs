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
const SHEET_NAME = "시트1";

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

/** sync: 예약 명단을 A~E열에 기록 (F열 체크인시간은 건드리지 않음) */
function syncReservations(dataArray) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!dataArray || dataArray.length === 0) {
    return jsonResponse({ status: "ok", message: "데이터 없음" });
  }

  // 기존 예약 목록 삭제 (F열 체크인시간 보존)
  clearOldReservations(sheet);

  // 새 예약 목록을 A~E열에 기록
  const rows = dataArray.map(item => [
    item.resNum      || "",           // A: 예약번호
    item.name        || "",           // B: 이름
    item.room        || "",           // C: 방 번호
    formatDate(item.checkin_date),    // D: 입실 날짜
    formatDate(item.checkout)         // E: 퇴실 날짜
  ]);

  const startRow = 2; // 1행은 헤더
  sheet.getRange(startRow, 1, rows.length, 5).setValues(rows);

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
