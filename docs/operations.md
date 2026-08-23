# 운영 문서

## 필요한 값

| 값                     | 용도                             | 보관 위치         |
| ---------------------- | -------------------------------- | ----------------- |
| `GOOGLE_ADMIN_EMAILS`  | 허용된 관리자 Google 이메일 목록 | Cloudflare secret |
| `AUTH_SECRET`          | Better Auth 세션·토큰 암호화     | Cloudflare secret |
| `APP_ENCRYPTION_KEY`   | D1 secret 암호화                 | Cloudflare secret |
| `GOOGLE_CLIENT_ID`     | Google OAuth client              | Cloudflare secret |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret       | Cloudflare secret |
| `GOOGLE_API_KEY`       | 제한된 Drive API project key     | Cloudflare secret |
| `APP_ORIGIN`           | 패스키 origin                    | Worker variable   |
| `RP_ID`                | WebAuthn relying party ID        | Worker variable   |

## 초기 배포

1. `terraform apply`로 GCP project, Drive API, API key, D1, Worker를 생성한다.
2. Google Cloud Console에서 Web application OAuth client를 만들고 `/api/auth/google/callback` callback URI를 등록한다.
3. D1 migration을 원격으로 적용한다.
4. Cloudflare secrets를 등록한다.
5. `bun run deploy`로 앱을 배포한다.
6. `GOOGLE_ADMIN_EMAILS`에 등록된 `email_verified` Google 계정으로 관리자 OAuth를 완료한다.
7. 관리자 화면에서 Google Drive 연결 상태와 전용 폴더 생성을 확인한다.
8. 테스트 브라우저에서 초대 링크를 열어 ID·비밀번호만으로 계정을 만든다. 패스키 없이 비밀번호 로그인되는지 확인한다.
9. **내 정보**에서 패스키를 등록한 뒤 패스키 로그인도 확인하고, 패스키 제거 후 비밀번호 로그인이 유지되는지 확인한다.
10. 관리자 화면의 **비밀번호 변경 링크**에서 활성 멤버를 선택해 링크를 직접 생성하고, 새 브라우저에서 사용한다. 이어서 비밀번호 변경 요청을 만든 뒤에도 같은 링크를 발급할 수 있는지 확인한다.
11. 각 사용자로 로그인해 **저장 공간**이 서로 다른 빈 폴더인지 확인하고, 한 사용자의 하위 폴더를 다른 사용자에게 공유해 **공유 폴더**에만 표시되는지 확인한다.

현재 `gdrive-share` Worker와 D1은 Wrangler로 배포되어 있다. Terraform으로 기존 리소스를 관리하려면 Cloudflare API Token과 Google Cloud ADC를 준비한 뒤, 먼저 기존 D1/Worker를 Terraform state로 import한다. Wrangler OAuth 토큰은 Terraform Cloudflare provider의 `api_token` 값으로 사용할 수 없다.

초기 Google bootstrap은 `bun run install:gcloud:ps1` 후 `bun run bootstrap:google-admin`으로 실행한다. `terraform/google/terraform.tfvars`가 있으면 그 값을 사용하고, 없으면 스크립트가 bootstrap project ID·새 project ID·billing 값을 직접 묻는다. Linux/macOS/WSL에서는 `bun run install:gcloud:sh`를 사용한다. gcloud를 설치하지 않는 경우 서비스 계정 JSON을 `bun run bootstrap:google-admin -- -GoogleCredentialsPath C:\secure\gdrive-terraform.json`으로 지정할 수 있다. 이 스크립트는 Google 프로젝트/API/API key를 Terraform으로 만들고 OAuth 동의 화면을 브라우저에서 연 뒤 OAuth Client ID·Secret과 허용 관리자 이메일을 입력받는다. 이후 API key·OAuth client·관리자 이메일 목록을 Worker secret으로 등록하고 `/setup`을 연다. 최종 Google OAuth 승인은 허용 목록에 등록된 계정으로 직접 수행한다.

## 점검 명령

```powershell
Invoke-WebRequest https://<host>/api/health | Select-Object -ExpandProperty Content
bunx wrangler tail gdrive-share
```

health 응답에서 `database: true`, `googleConnected: true`를 확인한다. `googleConnected`는
저장된 refresh token의 존재만 보지 않고 Google Drive API 호출까지 확인하므로 `false`이면
관리자 Google 계정으로 다시 **Drive 연결**을 완료한다. 파일 목록과 업로드가 동시에 실패하면
먼저 이 값을 확인한다.
운영 로그에 access token, refresh token, invite token, resumable session URL을 출력하지 않는다.

외부 Better Auth 이메일 가입 endpoint는 차단되어 있으며 멤버 계정은 초대 링크의 내부 가입
경로에서만 생성된다. POST·PUT·PATCH·DELETE 요청은 same-origin `Origin`이 없거나 다르면
거부된다. 파일 inline 미리보기는 text/plain으로 제한되어 HTML을 실행하지 않는다.

ID·비밀번호 로그인은 Better Auth 실패 후 연결된 `auth_account`의 credential password를 우선 검증하고, 연결 계정에 credential이 없을 때만 `users.password_hash`를 fallback으로 사용하는 호환 경로를 한 번 시도한다. 이 경로도 실패하면 기존 Better Auth 오류를 표시하며, 계정이 비활성화된 경우에는 로그인할 수 없다.

Google Drive 인증은 OAuth callback에서 발급받은 refresh token만 D1에 암호화해 보관한다. 파일
요청마다 access token을 갱신하고, Drive가 만료된 access token으로 401을 반환하면 새 token으로
한 번만 재시도한다. 따라서 연결 후 오래 쉬었다가 다시 사용해도 별도 로그인 없이 첫 요청에서
자동 갱신된다. `invalid_grant`처럼 Google이 refresh token 자체를 폐기한 경우에는 OAuth
동의 없이는 복구할 수 없으므로 관리자만 **Drive 연결**을 한 번 다시 완료해야 한다.
Cloudflare Cron(`0 18 * * *` UTC, 매일 03:00 KST)은 같은 연결 점검을 백그라운드에서 실행해
다음 사용 전에 상태를 확인한다. Google OAuth 동의 화면이 Testing 상태이면 Google 정책상
refresh token이 일정 기간 후 폐기될 수 있으므로, 정기적인 재연결을 없애려면 동의 화면을
Production으로 게시해야 한다. Cron은 폐기된 refresh token을 사용자 동의 없이 복구하지 않는다.

## OAuth 문제 해결

- 브라우저에서 `/api/auth/google/start` 또는 callback이 404이면 `wrangler.jsonc`의 `assets.run_worker_first`에 `/api/*`가 포함되어 있는지 확인한다. Cloudflare 정적 자산 라우터는 브라우저 문서 탐색을 Worker보다 먼저 처리할 수 있다.
- `invalid_client`이면 Client ID와 Secret을 다시 등록한다. Worker는 BOM과 앞뒤 개행을 제거하지만 Google Console에서 삭제된 OAuth client는 사용할 수 없다.
- `redirect_uri_mismatch`이면 Google Web OAuth Client의 승인된 리디렉션 URI를 정확히 `https://<host>/api/auth/google/callback`으로 등록한다.
- `OAuth state가 올바르지 않습니다`이면 같은 브라우저에서 로그인 시작을 여러 탭으로 중복 실행하지 말고 `/setup`부터 다시 시작한다. state와 로그인 모드는 10분짜리 `HttpOnly` 쿠키로 요청별 격리된다.
- 패스키 등록이 실패하거나 취소되어도 계정은 비밀번호로 계속 사용할 수 있다. **내 정보**에서 다시 등록한다. 패스키 context 암호화에는 항상 32바이트 `APP_ENCRYPTION_KEY`를 사용한다.

## Drizzle schema 변경

애플리케이션의 모든 D1 테이블은 `src/lib/server/drizzle/auth-schema.ts`에 정의되어 있다.
`bun run db:generate`는 Drizzle migration을 `drizzle/`에 생성한다. Cloudflare Wrangler가 실제 적용하는 파일은 `migrations/`이므로, 생성 SQL을 검토해 새 forward-only Wrangler migration으로 반영하고 먼저 `--local`에서 적용한다. 이미 적용한 migration 파일은 수정하지 않는다.

## 복구

- D1 장애: 마지막 백업 또는 Cloudflare D1 복구 기능을 사용한다.
- Google OAuth 폐기(`invalid_grant`): refresh token이 폐기된 경우이므로 관리자 Google 계정으로
  **Drive 연결**을 다시 진행한다. access token 만료 자체는 자동 갱신 대상이다.
- 패스키 분실: 비밀번호로 로그인한 뒤 **내 정보**에서 기존 패스키를 제거하고 새 패스키를 등록한다.
- 비밀번호 분실 또는 관리자 초기화: 관리자 화면의 **비밀번호 변경 링크**에서 활성 멤버를 선택해 링크를 생성하고 직접 전달한다. 사용자가 요청한 경우에는 아래 **분실 요청**에서 해당 요청의 링크를 생성한다.
- 업로드 실패: 업로드 tray의 실패 항목을 다시 올린다.
- 잘못 공유한 폴더: 소유자 또는 관리자가 폴더 행의 **공유 관리**에서 현재 대상의 **제거**를 누르고 저장한다. 공유를 해제해도 파일은 소유자의 개인 공간에 그대로 남는다.
- 계정 삭제: **내 정보 → 계정 삭제**에서 파일·공유·패스키 삭제 범위를 모두 확인하고 `계정 삭제`를 입력한다. 요청 즉시 로그인은 차단되고, Worker의 `waitUntil`이 소유 파일과 폴더를 Drive에서 삭제한 뒤 D1 메타데이터·공유 ACL·패스키·세션·계정을 제거한다. Drive 오류가 나면 작업 큐를 유지하며 Cron(`0 18 * * *` UTC)이 재시도한다. 공유받은 폴더는 원본 파일을 삭제하지 않고 해당 계정의 접근만 해제한다.

## 개인 공간과 공유 폴더 운영

- 사용자 개인 폴더는 해당 사용자가 처음 파일 목록을 열거나 업로드할 때 자동 생성된다. Drive 앱 루트의 폴더를 Google Drive 웹 UI에서 임의로 이동·삭제하지 않는다.
- 공유는 Google Drive의 공유 권한이 아니라 D1 `folder_shares` ACL로 제어한다. Drive 파일의 실제 소유·quota는 연결한 관리자 Google 계정에 남는다.
- 상단의 남은 공간 표시는 Google Drive `storageQuota` 기준이다. 권한을 추가한 뒤에는 관리자 Google Drive를 다시 연결해야 새 OAuth 권한이 refresh token에 반영된다.
- 기존 Drive 파일 다운로드 권한을 추가한 배포 뒤에는 관리자만 **Drive 연결**을 다시 완료한다. 기존 연결을 유지하면 파일 목록은 보여도 본문 다운로드가 403으로 거부될 수 있다.
- 핸들 변경 스키마를 배포할 때는 `migrations/0006_user_handles.sql`을 먼저 적용한다. 기존 계정의 `login_id`는 자동으로 핸들에 복사된다.
- 공유 관리에는 현재 공유 대상과 `pending` 초대가 함께 표시된다. 소유자와 관리자는 사용자를 추가·제거하고 `viewer` 또는 `editor` 권한을 지정할 수 있다. `viewer`는 조회·다운로드만, `editor`는 해당 폴더와 하위 폴더를 관리할 수 있다.

## 도메인 변경

패스키의 RP ID와 Google OAuth redirect URI는 host에 묶인다.
운영 도메인을 바꾸면 Google callback을 갱신하고 사용자가 새 도메인에 패스키를 추가 등록해야 한다.
