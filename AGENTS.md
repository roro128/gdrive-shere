# AGENTS.md

## 프로젝트 개요

GShare는 React Router v8 기반의 파일 작업공간입니다. Cloudflare Workers에서 실행되며,
Cloudflare D1(Drizzle ORM)을 메타데이터 저장소로 사용하고 Google Drive를 파일 저장소로
사용합니다. 인증은 Better Auth와 비밀번호·패스키 흐름으로 구성되어 있습니다.

주요 영역은 다음과 같습니다.

- `app/routes/`: React Router 페이지와 서버 API
- `src/lib/`: 공용 UI·도메인 로직·서버 모듈
- `drizzle/`, `migrations/`: ORM 스키마와 D1 migration
- `terraform/`: Cloudflare·Google Cloud 인프라
- `scripts/`: 로컬 도구 설치와 배포 보조 스크립트
- `docs/`: 설계·운영 문서

## 개발 환경과 명령

Windows에서는 PowerShell과 Bun을 기본으로 사용합니다.

```powershell
bun install
bun run dev
bun run check
bun run build
```

의존성·스크립트·lockfile을 임의의 패키지 매니저로 섞어 관리하지 않습니다. 환경 변수는
`.env.example`를 참고하고 비밀값은 커밋하지 않습니다.

## TDD/BDD 회귀 테스트 원칙

모든 기능 추가, 버그 수정, 인증·권한·파일 처리 변경은 TDD/BDD와 회귀 테스트 작성을
기본 원칙으로 합니다. 테스트 없이 구현을 완료했다고 판단하지 않습니다.

1. 먼저 요구사항을 사용자 시나리오 또는 도메인 행동(Given/When/Then)으로 정리합니다.
2. 실패하는 테스트를 먼저 작성해 변경의 기대 행동과 버그 재현을 고정합니다.
3. 테스트를 통과시키는 최소 구현을 합니다.
4. 리팩터링 후 같은 테스트와 관련 회귀 테스트를 다시 실행합니다.

테스트는 `src/**/*.test.ts`에 기능 코드와 가까이 배치하고, 테스트 이름은 구현 세부사항보다
관찰 가능한 행동을 설명합니다. 정상 경로만 검증하지 말고 권한 거부, 잘못된 입력, 중복,
만료·취소·재시도, 외부 API 오류와 같은 실패 경로도 적극적으로 테스트합니다. 기존 버그를
수정할 때는 재현 테스트를 먼저 추가하며, 테스트를 삭제하거나 약화해 통과시키지 않습니다.

```powershell
# 전체 단위·도메인 회귀 테스트
bun run test

# 작업 중 빠른 반복
bun run test:watch

# 변경 전 전체 품질 게이트
bun run quality
```

`bun run quality`는 Biome, ESLint, React Router 타입 생성·TypeScript 검사, Knip 데드코드 검사, Vitest를
실행합니다. 테스트 변경이나 인증·Drive·migration 변경이 있으면 최소한 관련 테스트와
전체 `bun run quality`를 실행합니다. UI 변경은 타입 검사만으로 충분하지 않으므로 개발
서버를 실행해 주요 사용자 흐름을 브라우저에서 직접 확인합니다.

## 코드 품질과 스타일

- TypeScript와 React Router의 기존 구조·이름·모듈 경계를 유지합니다.
- 입력만으로 결정되는 계산은 `src/lib/*-model.ts`의 순수 함수로 두고, React 상태 변경,
  `fetch`, DOM·File·WebAuthn, 시간·난수, DB·Drive 작업은 route/client/server effect 경계에
  남깁니다. 배열·Set·Map 입력을 직접 변경하지 말고 새 값을 반환합니다.
- `for...of`를 `map`으로 기계적으로 바꾸지 않습니다. DB·Drive 삭제, 업로드·다운로드처럼
  실행 순서·취소·오류 중단이 사용자에게 관찰되는 작업은 명시적인 순차 effect로 유지하고,
  그 앞단의 대상 선별·정책·결과 집계만 순수 모델로 분리합니다.
- 포맷은 Prettier, TypeScript/JavaScript 계열 린트는 Biome과 ESLint를 사용합니다.
- 사용하지 않는 코드와 import를 남기지 않습니다.
- 환경 변수, OAuth 토큰, 암호화 키, Drive session URL을 로그·응답·테스트 fixture에
  노출하지 않습니다.
- 서버 전용 자격 증명과 Drive 접근은 브라우저 번들로 유출되지 않도록 유지합니다.

```powershell
bun run format:check
bun run lint:biome
bun run lint
bun run lint:dead
bun run typecheck
```

## 데이터베이스와 배포

공유 링크는 원문 토큰을 저장하지 않고 해시만 저장하며, 링크 다운로드는 로그인 없이도 토큰·활성
파일·Drive 스트리밍을 모두 검증해야 한다. 링크 생성·해제는 소유자 또는 편집 권한 사용자만 가능하고,
공개 링크를 인증된 파일 API 권한 우회 수단으로 재사용하지 않는다.

Drizzle 스키마 변경은 먼저 다음 명령으로 migration을 생성하고 결과 SQL을 검토합니다.

```powershell
bun run db:generate
bunx wrangler d1 migrations apply gdrive-share --local
bun run build
```

원격 migration과 배포는 사용자가 대상 환경과 변경 내용을 확인한 뒤 실행합니다.

```powershell
bunx wrangler d1 migrations apply gdrive-share --remote
bun run deploy
```

배포 후에는 단순 build 성공만으로 완료 처리하지 말고 관리자 OAuth, 초대·로그인, 권한,
파일 업로드·다운로드·이름 변경·삭제·복구를 실제 브라우저와 연결된 환경에서 확인합니다.
`googleConnected`는 저장된 refresh token뿐 아니라 Google Drive API 호출까지 확인하므로
`false`이면 관리자 Google OAuth의 **Drive 연결**을 다시 완료하고 파일 목록·업로드를 재검증합니다.

## 문서와 변경 기록

새 동작·설정·운영 절차·제약이 생기면 관련 `README.md` 또는 `docs/` 문서를 함께 갱신합니다.
다른 에이전트가 재현할 수 있도록 명령, 필요한 환경 변수, 검증 범위와 미검증 범위를
구체적으로 기록합니다.

커밋 전에는 변경된 테스트와 품질 게이트 결과를 확인하고, 작업 범위를 벗어난 파일은
수정하지 않습니다.
