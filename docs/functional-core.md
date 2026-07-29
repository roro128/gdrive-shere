# 함수형 코어와 디버깅 경계

## 목적

GShare의 파일 작업 기능은 계산과 외부 효과를 분리한다. 입력만으로 결과가 결정되는 로직은
`src/lib/`의 순수 함수에 두고, React 컴포넌트는 화면 상태 연결과 `fetch`, 브라우저 API,
파일 업로드처럼 외부 효과가 필요한 작업만 실행한다.

이 경계는 다음 문제를 줄인다.

- 브라우저를 열지 않고 정렬·선택·권한·경로 분기를 재현한다.
- 네트워크 오류와 계산 오류를 서로 다른 테스트에서 찾는다.
- 테스트마다 전역 상태나 서버를 초기화하지 않는다.
- 실패한 함수에 작은 입력을 전달해 같은 결과를 즉시 재현한다.

## 구조

```text
React 이벤트
  -> 입력 정규화
  -> src/lib 순수 함수
  -> 명시적 결과
  -> React 상태 반영 또는 API 요청
```

## 리팩토링 규칙

함수형 전환은 모든 코드를 무조건 `map`과 `reduce`로 바꾸는 작업이 아니다. 다음 규칙으로
계산과 효과를 분리하고, 의미가 흐려지는 추상화는 추가하지 않는다.

- 순수 계산은 입력 컬렉션을 변경하지 않고 새 배열·`Set`·객체를 반환한다.
- 선택·충돌·권한·정렬처럼 입력만으로 결정되는 분기는 작은 조합 함수로 유지한다.
- React 상태, `fetch`, 시간·난수, DB·Drive 변경은 효과 경계에 남기고 순수 함수에 주입하지 않는다.
- 상태 전이 함수는 Given/When/Then 회귀 테스트로 정상·빈 입력·잘못된 입력·권한 거부를 고정한다.
- 반복문 제거 자체를 목표로 삼지 않는다. 외부 효과를 순차 실행해야 하는 서버 작업은 명시적인
  `for...of`가 더 읽기 쉽고 오류 처리가 안전할 수 있다.

현재 적용 순서:

1. `list-selection.ts`, `upload-conflicts.ts`, `workspace-model.ts`의 컬렉션 변환을 불변 결과로 정리한다.
2. `mock-workspace-model.ts`에 상태 전이를 모으고 `mock-workspace.ts`는 상태 저장·시간·응답 생성 어댑터로 유지한다.
3. 서버 API의 요청 검증·도메인 계산·DB/Drive 효과를 같은 경계로 분리한다. Google Drive
   요청 모델과 파일 목록·업로드 세션·공유·인증·비밀번호 재설정 계산은 이 단계에 포함된다.
4. React 이벤트의 선택 상태 전이도 모델 함수를 통해 계산하며, `Set` 변환은
   `list-selection.ts`에 모은다.
5. 각 단계마다 관련 테스트, 타입 검사, 전체 `bun run quality`를 순서대로 실행한다.

`app/routes/home.tsx`에는 다음 효과만 남긴다.

- React 상태 읽기와 갱신
- `fetch`, AbortController와 응답 처리
- DOM 좌표·드래그 이벤트
- File, Clipboard, WebAuthn 등 브라우저 API

## 순수 함수 카탈로그

### `workspace-model.ts`

- `buildWorkspaceRequest`: 현재 보기에서 호출할 API URL 결정
- `buildWorkspaceCacheKey`: 파일 목록 캐시 키 생성
- `deriveWorkspaceCollections`: 정렬·선택·업로드·공유 목록의 불변 파생 view-model 계산
- `sortWorkspaceFiles`: 원본 배열을 변경하지 않는 폴더 우선 정렬
- `summarizeActiveUploads`: 진행 중 업로드 수와 평균 진행률 계산
- `updatePendingIds`: pending ID 집합의 불변 추가·삭제
- `getFileKind`, `isPreviewableFile`: MIME 기반 표시·미리보기 판정
- `formatBytes`, `storagePercent`: 잘못된 값과 범위를 처리하는 표시 계산
- `getWorkspaceViewFlags`: 보기 전환을 상호 배타적 플래그로 변환
- `describeMoveResult`: 성공·부분 실패·no-op 이동 결과 문구 생성
- `file-response-model.ts`: 다운로드·미리보기 응답 헤더의 순수 계산
- `file-update-model.ts`: 파일 PATCH 입력·이동 정책, D1 메타데이터와 휴지통 상태 payload 변환

### 기존 함수형 모듈

- `list-selection.ts`: 전체 선택, 범위 선택, 제거된 ID 정리
- `list-selection.ts`: 전체 선택·범위 선택·제거 결과의 불변 `Set` 변환
- `file-permissions.ts`: 편집·휴지통 이동 가능 여부
- `file-move.ts`: 드래그 페이로드 해석과 다중 이동 결과 분리
- `workspace-availability.ts`: 보기와 권한에 따른 읽기·쓰기 가능 여부
- `workspace-availability.ts`: 파일 목록 로딩 source 결정(requests·unavailable·mock·remote)
- `workspace-availability.ts`: 현재 보기·권한·대상 폴더에 따른 업로드 허용 정책
- `upload-conflicts.ts`: 업로드 준비 파일과 이름 충돌 분리
- `mock-workspace-model.ts`: mock 파일·휴지통·이동·업로드·공유의 순수 상태 전이
- `mock-preview-model.ts`: 목업 텍스트·이미지 미리보기 data URL 계산
- `server/api-route-matching.ts`: 파일 경로 패턴 컴파일과 URL 파라미터 디코딩
- `server/space-access-model.ts`: 파일 조상 체인의 불변 경로 수집과 소유자·공유 권한 해석
- `server/runtime.ts`: 쿠키 헤더 파싱·직렬화
- `server/permanent-delete-model.ts`: 휴지통 하위 파일 ID의 계층 탐색과 안전한 삭제 순서 계산
- `server/file-hierarchy-model.ts`: 파일 이동 순환 참조 판정
- `server/google-request-model.ts`: Google OAuth·Drive 목록·폴더·업로드 요청 조립
- `server/google-request-model.ts`: 파일 이름 변경·폴더 이동 요청 조립
- `server/auth-model.ts`: 로그인 ID 정규화와 형식 판정
- `server/account-deletion-model.ts`: 계정 삭제 큐·처리·재시도 상태 payload와 Drive 404 재시도 예외·오류 메시지 정규화
- `avatar.ts`: 해시 기반 identicon SVG 계산
- `upload-flow-model.ts`: 업로드 청크 범위·헤더·진행률·재시도 판정과 지연 계산
- `upload-client.ts`: 네트워크·Abort·timer를 주입받는 업로드 효과 adapter와 진행 callback 경계
- `upload-client.ts`: 업로드 세션 취소 요청 adapter
- `upload-conflicts.ts`: 충돌 큐의 skip/replace/overwrite·apply-all 결정 계획
- `passkey-client.ts`: 패스키 등록 context·삭제 요청 효과 adapter
- `passkey-device-client.ts`: WebAuthn user ID encoding과 기기 credential 동기화 효과 adapter
- `navigation-client.ts`: OAuth 이동·세션/계정 전환 redirect 효과 adapter
- `browser-file-client.ts`: FileReader data URL·clipboard write 효과 adapter와 실패 결과
- `window-events.ts`: window event listener 등록·해제 조합과 동일 listener cleanup 경계
- `workspace-actions-model.ts`: 다운로드·삭제 대상, 충돌 적용 범위, 배치 성공 집계
- `drag-drop-model.ts`: 선택 파일·드롭 대상·드래그 payload 해석
- `drag-drop-model.ts`: 대상 권한과 선택 상태를 반영한 파일 이동 계획 계산
- `pointer-drag-model.ts`: pointer 이동 거리·활성화·drop target 상태 전이
- `pointer-drag-model.ts`: pointer session 생성·pointerId 매칭·좌표 projection
- `drag-interaction-model.ts`: native/external source·drop target·overlay 상태의 불변 전이
- `list-selection.ts`: 공유 멤버를 포함한 선택 ID의 불변 단일 전이
- `share-state.ts`: 공유 grant 생성과 검색 결과 병합
- `share-search-model.ts`: 공유 사용자 검색 필터와 비동기 generation 판정
- `share-search-client.ts`: mock·remote 공유 사용자 검색 효과와 응답 오류 경계
- `share-client.ts`: 공유 초대 조회·응답과 폴더 공유 조회·저장 요청 효과 adapter
- `server/file-list-model.ts`: 휴지통 DTO 변환, Drive 목록 메타데이터 병합, 공유 폴더 집합 계산
- `server/file-list-model.ts`: Drive 응답을 D1 동기화 메타데이터로 변환
- `server/file-list-model.ts`: Drive insert 레코드와 conflict update payload의 순수 조립
- `server/file-list-model.ts`: Drive 목록을 D1 sync operation plan으로 변환
- `server/file-list-model.ts`: 주입된 ID·clock으로 sync input을 만들고 shared lookup 폴더 후보를 계산
- `api/files/+server.ts`: 순수 Drive sync operation을 D1 batch effect로 실행
- `server/trash-cleanup-workflow.ts`: Drive 삭제 후 D1 삭제 순서와 실패 시 retry 결과를 주입 효과로 조정
- `server/drive-deletion-workflow.ts`: Drive 삭제 순서·missing 허용·중단 정책을 주입 효과로 조정
- 폴더 생성 API도 동일한 `toDriveFileSyncRecord`를 사용해 Drive 목록 동기화와 D1 레코드 shape를 공유한다.
- `server/upload-session-model.ts`: 업로드 세션 입력 정규화·충돌 정책·active session 레코드 조립
- `server/upload-session-model.ts`: 업로드 응답 완료 판정과 수신 바이트 계산
- `server/upload-session-model.ts`: 완료 업로드의 세션·Drive insert/update persistence plan 조립
- `server/upload-session-model.ts`: 진행률·취소 상태 update payload의 정규화
- `share-management.ts`: 공유 검색어·요청 검증, 중복 제거, 소유자 제외·개수 제한 정책
- `mock-workspace-model.ts`: 목업 파일 목록의 권한·공유 표시 장식
- `handle-availability.ts`: 핸들 정규화·검증·가용성 응답과 비동기 sequence 판정
- `handle-availability-client.ts`: mock·remote 핸들 가용성 조회 효과와 응답 경계
- `password-policy.ts`: 서버·클라이언트 공통 비밀번호 길이 정책
- `auth-form-model.ts`: 초대·비밀번호 재설정 확인 정책과 request body 순수 조립
- `password-reset-client.ts`: mock·remote reset context 조회 효과와 응답 경계
- `profile-client.ts`: 프로필·패스키 API의 request/response 효과 adapter
- `account-client.ts`: 계정 삭제 POST 효과와 서버·transport 오류 경계
- `admin-client.ts`: 관리자 초대·멤버 목록·상태 변경·비밀번호 재설정 링크 요청 효과 adapter
- `auth-client.ts`: 현재 사용자 조회·로그아웃·초대·비밀번호 인증 요청 효과 adapter
- `workspace-file-client.ts`: 폴더 생성·이름 변경·이동·휴지통·복구·영구 삭제 요청 효과 adapter
- `workspace-read-client.ts`: 파일 목록·storage quota 응답 decoding 효과 adapter
- `workspace-load-model.ts`: 파일 응답의 unauthorized/success/error·Abort 판정과 후속 command
- `workspace-refresh-model.ts`: cache read/write/invalidation과 stale refresh generation 판정
- `profile-input-model.ts`: 프로필 핸들 fallback·정규화와 아바타 data URL 검증
- `profile-update-model.ts`: 프로필 DB 값·응답 DTO·Better Auth image 동기화 payload의 불변 조합
- `profile-update-model.ts`: 프로필 PATCH request payload의 조건부 비밀번호 필드 조립
- `auth-response-model.ts`: 인증 사용자 DB 레코드의 UI 응답 DTO 변환
- `auth-response-model.ts`: 관리자 사용자 목록 응답 DTO의 불변 변환
- `server/webauthn-model.ts`: challenge·등록 passkey DB 레코드와 저장 transport JSON·credential 옵션·검증 credential의 안전한 순수 변환
- `server/webauthn-model.ts`: 주입된 clock/ID로 만료 WebAuthn challenge record 조립
- `server/webauthn-model.ts`: 주입된 clock/ID로 registered passkey record 조립
- `server/auth-record-model.ts`: 주입된 clock/ID로 legacy session record 조립
- `server/auth-record-model.ts`: 주입된 clock/ID로 invitation record와 TTL 조립
- `server/auth-record-model.ts`: 주입된 clock/ID로 Google admin user record 조립
- `server/upload-session-model.ts`: 주입된 clock/ID로 업로드 세션 만료와 완료 파일 row 조립
- `server/webauthn-model.ts`: 패스키 등록 context의 JSON·형식·만료 판정
- `server/webauthn-model.ts`: 패스키 등록 context payload의 순수 JSON·TTL 조립
- `server/better-auth.ts`: WebAuthn 만료 검증·context 생성에 주입 가능한 epoch clock 사용
- `server/avatar.ts`: 기본 아바타 identicon projection에 hash effect 주입
- `server/auth-model.ts`: 로그인 ID와 Google 관리자 이메일 정책 계산
- `server/auth-model.ts`: Better Auth 회원가입 request body·synthetic email 조립
- `server/auth-record-model.ts`: Google 관리자·초대·legacy session·pending/linked member·atomic invitation claim·status·avatar·passkey transition DB payload의 순수 조립
- `server/auth-record-model.ts`: 주입된 clock/ID로 pending·linked member·invitation claim record 조립
- `server/db-record-model.ts`: settings upsert와 audit event DB payload·metadata 직렬화
- `server/db-record-model.ts`: 개인 공간 생성 시 drive file·user space record payload 조립
- `server/db-runtime-model.ts`: 주입된 clock/ID로 settings·audit persistence plan 조립
- `server/password-reset-model.ts`: request/link DB 레코드·claim/status/password·Better Auth credential update 조립, 재설정 링크 상태 판정과 관리자 요청 DTO의 순수 변환
- `server/password-reset-model.ts`: 주입된 clock/ID로 pending request·link persistence plan 조립
- `server/share-persistence-model.ts`: 주입된 clock/ID로 폴더 공유 mutation plan 조립
- `server/db-record-model.ts`: 주입된 clock/ID로 개인 공간 생성 persistence record 조립
- `server/trash-cleanup-model.ts`: 주입된 현재 시각으로 휴지통 보존 cutoff·batch 정책 조립
- `server/account-deletion-model.ts`: 주입된 clock/ID로 queued deletion job payload 조립
- `server/account-deletion-model.ts`: 주입된 clock으로 processing/retry transition payload 조립
- `server/shared-folder-model.ts`: 수신·소유 공유 폴더 목록 조합, 수신자 이름 projection과 표시 메타데이터
- `server/shared-folder-model.ts`: 관리자 개인 공간의 workspace file DTO 변환
- `server/shared-folder-model.ts`: accepted/pending 수신자 rows의 owned folder projection 조립
- `server/share-persistence-model.ts`: 공유 grant·초대 수락/거절·pending invitation D1 mutation plan 계산
- `server/google-response-model.ts`: Google storage quota 응답 정규화
- `server/google-response-model.ts`: Google OAuth token·profile 응답의 connection DTO 변환
- `server/google-response-model.ts`: Google connection refresh token fallback·email persistence plan 계산
- `server/google-http-model.ts`: Google HTTP status·empty body·JSON/error 정책의 순수 판정
- `server/google.ts`: OAuth profile·Drive parent 조회의 조건부 effect를 명시적 값 계산으로 분리
- `api/handles/check/+server.ts`: handle 정규화 실패를 조건부 값으로 계산하고 DB effect와 분리
- `server/google-request-model.ts`: 업로드 chunk·다운로드 range 헤더의 불변 요청 조립
- `oauth-mode-model.ts`: Google OAuth 모드 파싱·시작 모드·권한 요청 정책 계산
- `oauth-mode-model.ts`: Google OAuth callback의 세션 생성·연결 저장·이메일 검증 계획 계산
- 서버 미리보기 MIME 판정도 `workspace-model.ts`의 `isPreviewableFile`을 공유해
  클라이언트·서버 정책이 분리되지 않도록 유지한다.
- `upload-state-model.ts`: 업로드 progress·완료·실패·취소·재시도 상태 전이
- `upload-flow-model.ts`: upload session request payload·chunk range·retry policy 계산
- `upload-chunk-workflow.ts`: chunk retry를 주입된 request/sleep effect로 재귀 실행
- `workspace-navigation-model.ts`: Workspace 뷰·폴더 경로·선택 상태 전이 reducer
- `resource-map-model.ts`: 업로드 file/controller registry의 불변 Map set/delete 전이
- `auth-card-model.ts`: 로그인·패스키·비밀번호 재설정 UI 상태 reducer
- `workspace-load-state-model.ts`: 캐시·mock·remote·오류 파일 목록 로딩 상태 reducer
- `drag-interaction-model.ts`: native·external drag target 상태 reducer와 불변 전이
- `share-panel-model.ts`: 공유 폴더·검색·선택·권한·저장 상태 reducer
- `profile-panel-model.ts`: 프로필·passkey·계정 삭제 확인 상태 reducer
- `admin-panel-model.ts`: 관리자 멤버·비밀번호 재설정 요청·생성 링크 상태 reducer
- `workspace-modal-model.ts`: 새 폴더·이름 변경·초대 링크·미리보기·컨텍스트 메뉴 상태 reducer
- `upload-panel-model.ts`: 업로드 목록·진행률·재시도·실패·충돌·트레이 표시 상태 reducer
- `invitation-panel-model.ts`: 공유 초대 목록과 응답 중 상태 reducer
- `workspace-interaction-model.ts`: 정렬·드래그 파일·pending 작업·선택 작업 상태 reducer
- `session-model.ts`: 인증 로딩·사용자 설정·세션 만료 상태 reducer
- `storage-quota-model.ts`: 저장공간 quota 성공·불가용·오류 상태 reducer
- `password-reset-form-model.ts`: 비밀번호 재설정 입력·제출·완료 상태 reducer
- `invite-form-model.ts`: 초대 가입 입력·아이디 availability·제출 상태 reducer
- `server/runtime.ts`: 요청 쿠키 파싱과 응답 쿠키 append의 순수 상태 전이, 이벤트 cookie adapter
- `server/api-route-matching.ts`: API route registry 우선순위·경로 매칭·parameter 병합
- `upload-lifecycle-model.ts`: 완료/실패 결과와 refresh command의 순수 정규화
- `upload-runtime-client.ts`: upload ID·AbortController·retry sleep 브라우저 효과 adapter
- `member-management.ts`: 관리자 멤버 상태·reset request·생성 링크의 불변 상태 전이
- `member-management.ts`: mock reset link의 origin·clock·TTL 조립
- `workspace-presentation.ts`: 파일·링크 시각의 표시 포맷 계산
- `file-move.ts`: 이동 대상 후보 선별과 이동 효과 결과 집계 분리
- `profile-state.ts`: 프로필 병합과 패스키 제거 전이
- `share-state.ts`: 공유 멤버 선택·권한·검색 결과 불변 전이
- `account-deletion.ts`: 계정 삭제 확인 scope 상태 전이와 검증
- `account-deletion.ts`: 계정 삭제 request payload와 acknowledgement 상태 전이
- `share-management.ts`: 활성 사용자 대상 선택과 공유 요청 정책

`mock-workspace.ts`는 위 모델을 호출하는 factory 효과 어댑터다. 상태는 각 어댑터 클로저에만 있고,
시간·UUID·`Response` 생성도 이 경계에서 실행한다. 모델 함수는 상태를 직접 변경하지 않고
항상 다음 상태와 작업 결과를 함께 반환한다.

## 빠른 검증

작업공간의 핵심 계산만 확인한다.

```powershell
bun run test:workspace
```

한 함수만 반복할 때는 테스트 파일을 직접 지정한다.

```powershell
bun run test -- src/lib/workspace-model.test.ts
bun run test:watch -- src/lib/list-selection.test.ts
```

전체 완료 조건은 다음 순서를 유지한다.

```powershell
bun run quality
bun run build
```

## 테스트 작성 규칙

1. 재현 입력과 기대 출력부터 작성하고 RED를 확인한다.
2. 테스트는 DOM 클래스나 React 내부 상태가 아니라 관찰 가능한 결과를 검증한다.
3. 배열·Set·객체를 입력받는 함수는 원본을 변경하지 않는지도 확인한다.
4. 빈 값, 잘못된 숫자, 오래된 선택 anchor, viewer 권한, 부분 실패를 정상 경로와 함께 검증한다.
5. 순수 함수 테스트에는 fetch, timer, localStorage, DOM mock을 추가하지 않는다.
6. 외부 효과 검증은 API 통합 테스트 또는 `?mock=1` 브라우저 흐름에서 별도로 수행한다.

## 디버깅 순서

1. `bun run test:workspace`로 계산 계층의 회귀 여부를 확인한다.
2. 실패한 테스트 파일만 watch 모드로 실행해 최소 입력으로 재현한다.
3. 계산 테스트가 통과하면 API 응답, Abort 여부, 브라우저 이벤트 순서 등 효과 계층을 확인한다.
4. 드래그·선택·미리보기는 `?mock=1&mockReset=1`에서 먼저 재현한다.
5. 실제 Google Drive 완료 판단은 인증된 환경의 요청 성공과 새 목록 반영까지 확인한다.

순수 함수 테스트 통과만으로 실제 OAuth, Drive 업로드·다운로드 또는 인증된 드래그 이동이
검증됐다고 판단하지 않는다.
