/* =========================================================
   1. 메인 화면 제목 자동 변경 (시간대별)
   ========================================================= */
function updateHeadline() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const headline = document.getElementById("dynamic-headline");

    // 오후 3시(15시) ~ 밤 11시(23시)
    if (hours >= 15 && hours < 23) {
        headline.textContent = "💻👆SELF CHECK-IN";
    }
    // 밤 11시(23시) 이후 ~ 새벽 5시 이전
    else if (hours >= 23 || hours < 5) {
        headline.textContent = "FRONT DESK IS CLOSED🕰️❌";
    }
    // 아침 5시 ~ 오전 11시까지
    else if (hours >= 5 && hours < 11) {
        headline.textContent = "NO NEED TO CHECK OUT 😄✋";
    }
    // 오전 11시 ~ 11시 40분 (체크인/체크아웃 선택)
    else if (hours === 11 && minutes < 40) {
        headline.textContent = "CHECK-IN or CHECK-OUT?";
    }
    // 그 외 시간 (청소 시간)
    else {
        headline.textContent = "CLEANING TIME🛏️🧹";
    }
}

updateHeadline();
setInterval(updateHeadline, 60000); // 1분(60,000ms)마다 확인해서 자동 변경

/* =========================================================
   2. 각 언어 선택 버튼을 눌렀을 때 이동할 페이지 결정
   ========================================================= */
function getTargetPage(language) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    if (hours >= 15 && hours < 23) {
        return `pages/self_check_in.html?lang=${language}`;
    } else if (hours >= 23 || hours < 5) {
        return `pages/reception_closed.html?lang=${language}`;
    } else if (hours >= 5 && hours < 11) {
        return `pages/no_check_out.html?lang=${language}`;
    } else if (hours === 11 && minutes < 40) {
        return `pages/checkin_out_selection.html?lang=${language}`;
    } else {
        return `pages/cleaning_time.html?lang=${language}`;
    }
}

// 위에서 결정된 페이지로 사용자를 이동시키는 이벤트(클릭) 연결
document.getElementById("btn-korean").addEventListener("click", () => {
    window.location.href = getTargetPage("ko");
});
document.getElementById("btn-chinese").addEventListener("click", () => {
    window.location.href = getTargetPage("zh");
});
document.getElementById("btn-japanese").addEventListener("click", () => {
    window.location.href = getTargetPage("ja");
});
document.getElementById("btn-english").addEventListener("click", () => {
    window.location.href = getTargetPage("en");
});
document.getElementById("btn-russian").addEventListener("click", () => {
    window.location.href = getTargetPage("ru");
});
document.getElementById("btn-spanish").addEventListener("click", () => {
    window.location.href = getTargetPage("es");
});
document.getElementById("btn-mongolian").addEventListener("click", () => {
    window.location.href = getTargetPage("mn");
});

/* =========================================================
   3. 오후 3시에 체크인 시작 안내 음성 1회 자동 재생
   ========================================================= */
let played = false;
function playCheckinAnnouncement() {
    const readyAudio = document.getElementById("checkinReady");
    // 오디오 파일 재생 시도 (실패 시 에러 로그 출력)
    readyAudio.play().catch(err => console.error("오디오 재생 오류:", err));
}

function checkTimeAndPlay() {
    const now = new Date();
    // 정각 3시 0분에 한 번 실행
    if (now.getHours() === 15 && now.getMinutes() === 0 && !played) {
        playCheckinAnnouncement();
        played = true;
    }
}
setInterval(checkTimeAndPlay, 10000); // 10초마다 시간 체크

/* =========================================================
   4. 웹캠 움직임 감지 기능 및 안내 음성 재생 & 화면 반짝임 처리
   ========================================================= */
const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// --- 설정값 ---
const COOLDOWN = 90_000;          // 음성 재생 후 쿨타임 (1분 30초: 90,000ms)
const REQUIRED_ACTIVE_MS = 3_000; // 움직임이 얼마나 지속되어야 작동할지 (3초: 3,000ms)
const DIFF_THRESHOLD = 9_000_000; // 변화량 민감도 (숫자를 낮추면 더 예민해짐)
const FLASH_INTERVAL = 200;       // 화면 깜빡임 속도 (0.2초)
const FLASH_BORDER_THICKNESS = 100; // 화면 가장자리 하늘색 빛 두께

// --- 상태값 ---
let lastImageData = null;
let voicePlaying = false;
let lastVoiceTime = 0;
let motionStartTime = null;
let flashTimer = null;
let stableCount = 0;

// 특정 prefix 기준의 랜덤 오디오 파일을 고르는 도우미 함수 (1~count 사이)
function getRandomFile(prefix, count) {
    const index = Math.floor(Math.random() * count) + 1;
    return `./audio/${prefix}_${index}.m4a`;
}

// 화면 주변 테두리에 파란색 번짐 효과를 주는 함수
function startFlash() {
    let existingOverlay = document.getElementById("flashOverlay");
    if (existingOverlay) existingOverlay.remove(); // 기존 효과 끄기

    const overlay = document.createElement("div");
    overlay.id = "flashOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0"; // 상하좌우 꽉 차게
    overlay.style.pointerEvents = "none"; // 클릭 방해 안 함
    overlay.style.zIndex = "9999"; // 제일 맨 위
    overlay.style.boxSizing = "border-box";

    // 테두리 안쪽으로 번지는 4방향 그라데이션 만들기
    const T = `${FLASH_BORDER_THICKNESS}px`;
    const EDGE_COLOR = "rgba(70, 170, 255, 0.9)"; // 테두리 색깔
    const EDGE_TRANSPARENT = "rgba(70, 170, 255, 0)"; // 번지면서 투명해짐

    overlay.style.backgroundImage = [
        `linear-gradient(to bottom, ${EDGE_COLOR}, ${EDGE_TRANSPARENT} ${T})`,
        `linear-gradient(to top, ${EDGE_COLOR}, ${EDGE_TRANSPARENT} ${T})`,
        `linear-gradient(to right, ${EDGE_COLOR}, ${EDGE_TRANSPARENT} ${T})`,
        `linear-gradient(to left, ${EDGE_COLOR}, ${EDGE_TRANSPARENT} ${T})`
    ].join(",");

    overlay.style.backgroundSize = `100% ${T}, 100% ${T}, ${T} 100%, ${T} 100%`;
    overlay.style.backgroundPosition = `0 0, 0 100%, 0 0, 100% 0`;
    overlay.style.backgroundRepeat = "no-repeat";

    // 깜빡이는 애니메이션 부드러운 시작(페이드 인)
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.25s ease";
    document.body.appendChild(overlay);

    // 0.2초마다 보였다 사라졌다 토글
    let on = false;
    flashTimer = setInterval(() => {
        on = !on;
        overlay.style.opacity = on ? "1" : "0";
    }, FLASH_INTERVAL);
}

// 화면 깜빡임 효과 종료
function stopFlash() {
    clearInterval(flashTimer);
    const overlay = document.getElementById("flashOverlay");
    if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 300); // 0.3초 뒤에 삭제
    }
}

// 랜덤 영어, 중국어 음성 조합해서 재생하는 함수
function playVoiceSet(setCount, totalSets) {
    const enFile = getRandomFile("EN", 9); // 영어 1~9 파일
    const zhFile = getRandomFile("ZH", 9); // 중국어 1~9 파일

    console.log(`🎧 시스템 음성 오디오 세트 ${setCount}/${totalSets}: ${enFile} → ${zhFile}`);

    const enAudio = new Audio(enFile);
    const zhAudio = new Audio(zhFile);

    // 기본 볼륨
    enAudio.volume = 1.0;
    zhAudio.volume = 1.0;

    // 전체 소리를 3배 증폭 (브라우저 정책상 제한될 수 있음)
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.8;

        const enSrc = audioCtx.createMediaElementSource(enAudio);
        const zhSrc = audioCtx.createMediaElementSource(zhAudio);
        enSrc.connect(gainNode).connect(audioCtx.destination);
        zhSrc.connect(gainNode).connect(audioCtx.destination);
    } catch (err) {
        console.warn("볼륨 증폭 노드 생성 실패:", err);
    }

    // 재생 순서 (영어 재생 끝남 -> 중국어 시작)
    enAudio.play().catch(err => console.error("영어 파일 재생 오류:", err));
    enAudio.onended = () => {
        zhAudio.play().catch(err => console.error("중국어 파일 재생 오류:", err));
        zhAudio.onended = () => {
            // 지정된 세트수(예: 2회 반복)를 다 못 끝냈으면 다음 세트로 재귀
            if (setCount < totalSets) {
                setTimeout(() => playVoiceSet(setCount + 1, totalSets), 1000); // 1초 쉬고 다음 세트
            } else {
                // 모든 세트가 끝나면 화면 반짝임 끄고 쿨다운 진입
                stopFlash();
                voicePlaying = false;
                lastVoiceTime = Date.now();
                console.log("✅ 모든 안내음성 재생 완료 (약 1분 30초 쿨다운 시작)");
            }
        };
    };
}

// 실제 움직임을 화면의 픽셀 차이로 감지하는 로직
function detectMotion() {
    const now = Date.now();
    const h = new Date().getHours();
    // 오전 7시부터 밤 11시(23시) 사이에만 작동
    if (h < 7 || h >= 23) return;

    // 현재 재생 중이거나 아직 쿨다운(휴식) 중이면 패스
    if (now - lastVoiceTime < COOLDOWN || voicePlaying) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (lastImageData) {
        let diff = 0;
        // 전후 화면 픽셀 데이터를 비교해서 얼마나 많이 달라졌는지 합산
        for (let i = 0; i < current.data.length; i += 4) {
            diff += Math.abs(current.data[i] - lastImageData.data[i]);
        }
        const motionDetected = diff > DIFF_THRESHOLD;

        if (motionDetected) {
            // 움직임이 처음 발견된 시간 기록
            if (motionStartTime === null) motionStartTime = now;
            stableCount = 0; // 안정이 깨짐

            // 3초 이상 지속적으로 감지되었을 때 작동 시작
            if (now - motionStartTime >= REQUIRED_ACTIVE_MS) {
                motionStartTime = null; // 초기화
                voicePlaying = true;    // 음성 실행 중으로 표시

                startFlash();      // 깜빡임 시작
                playVoiceSet(1, 2); // (1번째 세트, 총 2번 반복해라)
            }
        } else {
            stableCount++;
            // 계속 잠잠하면 시간 카운트 초기화
            if (stableCount > 10) motionStartTime = null;
        }
    }
    lastImageData = current; // 다음번 비교를 위해 현재 상태 저장
}

// 웹 카메라 권한 획득 및 프로세스 시작
navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            setInterval(detectMotion, 500); // 0.5초(500ms)에 1번씩 카메라 비교 실행
        };
    })
    .catch((err) => {
        console.error("웹캠 접근 오류 (접근이 차단되었거나 없습니다):", err);
    });

/* =========================================================
   5. 키오스크 환경용: 키보드 'F1(도움말)' 키가 멋대로 열리는 동작 방지
   ========================================================= */
document.addEventListener("keydown", function (event) {
    if (event.key === "F1") {
        event.preventDefault(); // 기본 도움말 창 무시
        return false;
    }
});
