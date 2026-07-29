# 함수형 리팩터링 분석 및 완료 범위

## 분석 기준

2026-07-29 현재 작업 트리를 기준으로 `app/`, `workers/`, `src/lib/`의 TypeScript와
TSX 파일, 인접 회귀 테스트, `package.json` 품질 게이트를 분석했다. 기존의 React Router
마이그레이션 변경은 사용자 작업으로 간주하고 보존한다.

## 구조 진단

| 영역                              | 현재 상태                                                      | 판단                                    |
| --------------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `src/lib/*-model.ts`              | 선택·권한·업로드·공유·상태 reducer가 대부분 순수 함수로 분리됨 | 유지·세부 정리                          |
| `src/lib/*-client.ts`             | `fetch`, Abort, WebAuthn, 브라우저 API가 adapter로 분리됨      | 효과 경계 유지                          |
| `src/lib/server/*-model.ts`       | Drive/DB payload와 정책 계산이 순수 함수로 분리됨              | 유지·세부 정리                          |
| `src/lib/api/`                    | 인증·DB·Drive 효과가 서버 경로에 남아 있음                     | 반복문 제거 대상 아님                   |
| `app/routes/home.tsx`             | UI와 브라우저 이벤트를 포함한 3,486줄 진입점                   | 순수 계산을 모델로 이동하고 효과는 유지 |
| `src/lib/mock-workspace-model.ts` | 순수 상태 전이지만 계층 탐색과 projection에 중복 계산 존재     | 이번 작업에서 정리                      |

## 우선순위

1. workspace와 mock workspace의 정렬·분류·계층 탐색·projection을 불변 순수 함수로 유지한다.
2. React reducer와 브라우저 이벤트는 이미 모델/adapter 경계가 있으므로 동작을 바꾸지 않는다.
3. 인증·Drive·DB는 명시적 순차 효과와 오류 중단 정책을 보존한다. 모든 `for...of` 또는
   `await`를 무조건 `map`으로 바꾸지 않는다.
4. 새 계산은 Given/When/Then 회귀 테스트를 먼저 추가하고, 전체 품질 게이트로 확인한다.

## 완료 판정

- 순수 입력 배열·Set·Map을 변경하지 않는다.
- 중복 ID, 빈 입력, 잘못된 입력, 권한 거부, 순환 계층을 테스트한다.
- `bun run quality`와 `bun run build`를 순차 실행한다.
- OAuth, 실제 Google Drive, 인증 브라우저 흐름은 이 순수 리팩터링의 검증 범위가 아니다.

## 잔여 전환 범위 판정

전수 재검토 결과, 추가로 함수형 코어로 옮길 수 있는 도메인 계산은 없다. `home.tsx`에
남은 반복은 다운로드의 간격 제어, 업로드 시작, 영구 삭제의 순차 실패 처리처럼 사용자에게
관찰되는 순서와 취소 경계를 갖는 효과다. `src/lib/api/`와 `src/lib/server/`의 DB·Drive·쿠키
작업도 같은 이유로 effect adapter에 남긴다.

남아 있던 선택 삭제 대상 필터는 `workspace-actions-model.ts`의 `actionableFiles`로 통합했다.
향후 새 계산이 React 이벤트나 API handler에 추가되면 먼저 `src/lib/*-model.ts`에 순수 함수와
Given/When/Then 테스트를 추가하고, effect adapter에서 호출한다.
