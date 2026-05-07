# Ya Korea Guesthouse Kiosk Project — Claude Instructions

## 작업 컴퓨터 식별 규칙

이 프로젝트는 두 컴퓨터에서 동시에 작업한다. 매 응답 **첫 줄**에 반드시 아래 헤더를 표기한다.

| 작업 디렉토리 | 헤더 |
|---|---|
| `C:\project\...` | `[키오스크 PC]` |
| `C:\Project_Claude\...` | `[노트북]` |

**이유:** 두 컴퓨터가 같은 git 레포를 공유하지만 역할이 다름. Claude가 잘못된 컴퓨터 기준으로 안내하면 사용자에게 혼란을 초래함.

### 구분 기준
- 반드시 **절대 경로**로 식별 (`C:\project` vs `C:\Project_Claude`)
- 두 컴퓨터 모두 `chat-system/` 폴더가 있으므로 폴더 존재 여부로 판단하지 말 것

### 배포 흐름
- **채팅 위젯 수정** (chat-system/): 키오스크 PC 또는 노트북에서 수정 → `git push` → 상대 컴퓨터에서 `git pull` → **노트북에서 Railway 배포**
- **키오스크 페이지 수정** (pages/, js/, css/, data/): 키오스크 PC에서 수정 → `git push` → 노트북에서 `git pull` (필요 시)
