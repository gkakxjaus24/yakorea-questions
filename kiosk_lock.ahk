#Requires AutoHotkey v2.0
#SingleInstance Force
; =====================================================================
;  야코리아 키오스크 잠금 스크립트 (AutoHotkey v2)
;  - 손님이 키오스크 화면을 빠져나가지 못하도록 탈출 키를 모두 차단
;  - 직원만 비밀 조합(Ctrl+Alt+0)으로 잠금 해제 + 키오스크 종료
;  - Chrome 이 닫히면 자동으로 다시 실행(워치독)
;
;  ※ Ctrl+Alt+Del 보안화면만은 Windows 정책상 어떤 프로그램도 막을 수 없음
;     (단, 그 화면에서는 파일/바탕화면 접근 불가. 작업관리자는 아래에서 차단함)
; =====================================================================

; ── 설정 ─────────────────────────────────────────────────────────────
ChromePath := "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
ChromeArgs := '--profile-directory="Profile 5" --ignore-profile-directory-if-not-exists --kiosk "http://localhost:8000/index.html"'

global ExitRequested := false

; ── Chrome 실행 + 워치독 ─────────────────────────────────────────────
LaunchChrome() {
    global ChromePath, ChromeArgs
    Run('"' ChromePath '" ' ChromeArgs)
}

Watchdog(*) {
    global ExitRequested
    if ExitRequested
        return
    if !ProcessExist("chrome.exe")
        LaunchChrome()
}

LaunchChrome()
SetTimer(Watchdog, 3000)   ; 3초마다 Chrome 살아있는지 확인

; ── 직원 전용 비밀 종료: Ctrl + Alt + 0 ──────────────────────────────
^!0:: {
    global ExitRequested
    ExitRequested := true
    SetTimer(Watchdog, 0)               ; 워치독 중지(다시 안 띄움)
    RunWait('taskkill /F /IM chrome.exe', , "Hide")
    ExitApp                              ; 스크립트 종료 → 모든 키 차단 해제
}

; ── 탈출/시스템 키 차단 (눌러도 아무 동작 안 함) ─────────────────────
!F4::return          ; Alt+F4 (창 닫기)
^w::return           ; Ctrl+W (탭 닫기)
^+w::return          ; Ctrl+Shift+W (창 닫기)
^t::return           ; Ctrl+T (새 탭)
^+t::return          ; Ctrl+Shift+T (탭 복원)
^n::return           ; Ctrl+N (새 창)
^+n::return          ; Ctrl+Shift+N (시크릿 창)
^o::return           ; Ctrl+O (파일 열기)
^p::return           ; Ctrl+P (인쇄)
^s::return           ; Ctrl+S (저장)
^u::return           ; Ctrl+U (소스 보기)
^j::return           ; Ctrl+J (다운로드)
^h::return           ; Ctrl+H (방문기록)
^+i::return          ; 개발자도구
^+j::return          ; 개발자도구 콘솔
^+c::return          ; 개발자도구 검사
^F4::return          ; Ctrl+F4 (탭 닫기 → Chrome 종료 방지)
; 기능키 F1~F12 전부 차단 (F1=도움말 열기 등 외부 페이지 이동 방지)
F1::return
F2::return
F3::return           ; 찾기
F4::return
F5::return           ; 새로고침
F6::return           ; 주소창 포커스
F7::return
F8::return
F9::return
F10::return
F11::return          ; 전체화면 토글
F12::return          ; 개발자도구
!Tab::return         ; Alt+Tab (창 전환)
!+Tab::return        ; Alt+Shift+Tab
^Esc::return         ; Ctrl+Esc (시작 메뉴)
!Esc::return         ; Alt+Esc
^+Esc::return        ; Ctrl+Shift+Esc (작업관리자)
LWin::return         ; 왼쪽 윈도우 키
RWin::return         ; 오른쪽 윈도우 키
AppsKey::return      ; 메뉴 키(우클릭 키)
#r::return           ; Win+R (실행)
#e::return           ; Win+E (탐색기)
#d::return           ; Win+D (바탕화면 보기)
#m::return           ; Win+M (최소화)
#Tab::return         ; Win+Tab (작업 보기)
#l::return           ; Win+L (잠금)  ※ 일부 환경에선 OS가 우선할 수 있음
