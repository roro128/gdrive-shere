# 공개 저장소 경계

이 저장소는 공개 GitHub 업로드를 전제로 다음 데이터를 Git에 넣지 않는다.

- `.env`, `.env.*`(예외: `.env.example`), `.dev.vars*`
- 실제 `terraform.tfvars`, Terraform state와 state 백업
- API 키, OAuth client secret, access/refresh token, 개인키, 서비스 계정 JSON
- `.wrangler/`, 브라우저 프로필, `.react-router/`, QA 스크린샷과 개발 로그

예시 설정 파일에는 실제 계정·토큰을 넣지 않는다. Cloudflare secret은 `wrangler secret put`으로 등록하고,
Terraform 변수와 state는 로컬에서만 관리한다. `wrangler.jsonc`의 Worker 이름·공개 origin·D1 database ID는
자격 증명이 아닌 운영 식별자이므로 배포 재현성을 위해 남겨 두었다. 서비스 위치 자체를 공개하고 싶지 않다면
첫 공개 push 전에 해당 값을 별도 공개용 설정으로 분리한다.

## 공개 전 점검

```powershell
bun run security:public
git status --short --ignored
git ls-files | rg -i '(^|/)(\.env($|\.)|\.dev\.vars|.*\.tfstate|.*\.tfvars$|.*\.(pem|key|p12|pfx|jks|keystore)$|credentials|service-account|\.codex-.*\.log$)'
```

`bun run security:public`은 추적 파일명과 Git index의 고위험 토큰 패턴을 검사하며, 토큰 원문은 출력하지 않는다.
이미 공개된 적 있는 자격 증명이 발견되면 단순히 파일을 지우지 말고 먼저 provider에서 해당 자격 증명을 폐기·재발급한
뒤, Git 이력 정리 여부를 별도로 결정한다.

현재 정리에서 발견된 `.codex-*` QA 산출물은 로컬 전용 파일로 분류해 추적 대상에서 제외했다. 과거 커밋에 포함된
파일까지 공개 이력에서 제거해야 한다면, 원격 저장소 생성 전에 이력을 재작성하거나 공개용 squash 커밋을 만든다.
