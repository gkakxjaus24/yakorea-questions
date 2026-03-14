# 야코리아 채팅 시스템 V2 — 배포 가이드

서버(Railway) → 관리자 페이지(Vercel) 순서로 배포합니다.

---

## 사전 준비

- GitHub에 `chat-system` 폴더가 포함된 저장소가 있어야 합니다.
- Railway 계정: https://railway.app
- Vercel 계정: https://vercel.com

---

## 1단계: GitHub에 코드 올리기

`chat-system` 폴더 전체를 GitHub 저장소에 push합니다.

```bash
cd /c/project
git add chat-system/
git commit -m "chat-system v2 배포 준비"
git push
```

> **주의**: `.env`와 `.env.local` 파일은 `.gitignore`에 포함되어 있어 자동으로 제외됩니다.

---

## 2단계: Railway에 서버 배포

### 2-1. 프로젝트 생성
1. [railway.app](https://railway.app) 접속 → **New Project** 클릭
2. **Deploy from GitHub repo** 선택
3. 저장소 선택 → **Root Directory를 `chat-system/server`로 설정**

### 2-2. 환경변수 입력
Railway 대시보드 → **Variables** 탭에서 아래 값들을 입력합니다.

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | Supabase 대시보드에서 복사 |
| `SUPABASE_ANON_KEY` | Supabase 대시보드에서 복사 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 대시보드에서 복사 |
| `JWT_SECRET` | 아래 명령어로 생성한 값 |
| `MANAGER_EMAIL` | 관리자 이메일 |
| `MANAGER_PASSWORD` | 관리자 비밀번호 |
| `ALLOWED_ORIGINS` | (3단계 이후에 추가) |

> **JWT_SECRET 생성**:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

> **PORT는 입력하지 않아도 됩니다.** Railway가 자동으로 설정합니다.

### 2-3. 배포 확인
- 배포가 완료되면 Railway가 URL을 발급합니다.
- 예: `https://yakorea-chat-server.up.railway.app`
- `https://[발급된URL]/api/health` 에 접속해서 `{"status":"ok"}` 확인

---

## 3단계: Vercel에 관리자 페이지 배포

### 3-1. 프로젝트 생성
1. [vercel.com](https://vercel.com) 접속 → **Add New Project** 클릭
2. GitHub 저장소 선택 → **Root Directory를 `chat-system/admin`으로 설정**
3. Framework: **Next.js** (자동 감지됨)

### 3-2. 환경변수 입력
Vercel 대시보드 → **Environment Variables** 에서 입력:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | Railway에서 발급된 서버 URL |

예: `https://yakorea-chat-server.up.railway.app`

### 3-3. 배포 확인
- 배포 완료 후 Vercel URL 발급
- 예: `https://yakorea-admin.vercel.app`
- 로그인 페이지가 정상 표시되는지 확인

---

## 4단계: CORS 설정 완료

Railway 대시보드 → **Variables** 탭으로 돌아가서:

| Key | Value |
|-----|-------|
| `ALLOWED_ORIGINS` | `https://yakorea-admin.vercel.app` |

여러 도메인을 허용해야 한다면 쉼표로 구분:
```
https://yakorea-admin.vercel.app,https://your-custom-domain.com
```

와일드카드 패턴도 지원합니다:
```
*.vercel.app
```

변수 저장 후 Railway가 자동으로 서버를 재시작합니다.

---

## 5단계: 위젯 키오스크에 연결

키오스크 HTML 파일에 아래 한 줄을 추가합니다:

```html
<script src="https://[Railway URL]/widget/chat-widget.js"></script>
```

예:
```html
<script src="https://yakorea-chat-server.up.railway.app/widget/chat-widget.js"></script>
```

위젯은 언어(`?lang=ko` 등)를 자동으로 감지하며, 서버 주소도 스크립트 URL에서 자동으로 읽어옵니다.

---

## 이후 업데이트 방법

코드 수정 후 GitHub에 push하면:
- **Railway**: 서버가 자동으로 재배포됩니다.
- **Vercel**: 관리자 페이지가 자동으로 재빌드됩니다.

별도 작업이 필요 없습니다.

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 관리자 페이지 API 오류 | `NEXT_PUBLIC_API_URL` 미설정 | Vercel 환경변수 확인 |
| 소켓 연결 실패 | CORS 차단 | Railway `ALLOWED_ORIGINS`에 Vercel URL 추가 |
| 서버 500 에러 | Supabase 키 오류 | Railway Variables의 Supabase 키 재확인 |
| 로그인 실패 | JWT_SECRET 또는 계정 불일치 | Railway Variables 재확인 |
