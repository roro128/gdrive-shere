[CmdletBinding()]
param(
  [string]$WorkerOrigin = 'https://gdrive-share.codo.workers.dev',
  [string]$GoogleCredentialsPath = '',
  [switch]$SkipTerraform,
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$googleTerraform = Join-Path $repo 'terraform/google'

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name 명령을 찾을 수 없습니다. 먼저 설치하고 PATH를 확인하세요."
  }
}

function Read-PlainSecret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Set-WorkerSecret([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "$Name 값이 비어 있습니다." }
  $env:GDRIVE_SHARE_SECRET_NAME = $Name
  $env:GDRIVE_SHARE_SECRET_VALUE = $Value
  try {
    $bunSecretScript = "const name=process.env.GDRIVE_SHARE_SECRET_NAME; const value=process.env.GDRIVE_SHARE_SECRET_VALUE; const child=Bun.spawn(['bunx','wrangler','secret','put',name],{stdin:'pipe',stdout:'inherit',stderr:'inherit'}); child.stdin.write(value); child.stdin.end(); const code=await child.exited; process.exit(code);"
    bun -e $bunSecretScript
    if ($LASTEXITCODE -ne 0) { throw "$Name secret 등록에 실패했습니다." }
  } finally {
    Remove-Item Env:GDRIVE_SHARE_SECRET_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:GDRIVE_SHARE_SECRET_VALUE -ErrorAction SilentlyContinue
  }
}

Require-Command terraform
Require-Command bun

$detectedGcloud = (Get-Command gcloud -ErrorAction SilentlyContinue).Source
if ($detectedGcloud -and $detectedGcloud.EndsWith('.ps1')) {
  $detectedGcloud = Join-Path (Split-Path -Parent $detectedGcloud) 'gcloud.cmd'
}
$gcloudCandidates = @(
  $detectedGcloud,
  "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "$env:USERPROFILE\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if ($gcloudCandidates) {
  $gcloudDirectory = Split-Path -Parent $gcloudCandidates[0]
  $env:Path = "$gcloudDirectory;$env:Path"
  Write-Host "Google Cloud CLI found: $($gcloudCandidates[0])"
}

if ($GoogleCredentialsPath) {
  if (-not (Test-Path -LiteralPath $GoogleCredentialsPath)) {
    throw "Google credentials JSON을 찾을 수 없습니다: $GoogleCredentialsPath"
  }
  $env:GOOGLE_APPLICATION_CREDENTIALS = (Resolve-Path -LiteralPath $GoogleCredentialsPath).Path
}

if (-not $env:GOOGLE_APPLICATION_CREDENTIALS -and -not $gcloudCandidates) {
  throw 'gcloud가 설치되지 않았습니다. Google Cloud CLI를 설치하거나 -GoogleCredentialsPath로 서비스 계정 JSON을 지정하세요.'
}

if (-not $env:GOOGLE_APPLICATION_CREDENTIALS -and $gcloudCandidates) {
  $adcPath = Join-Path $env:APPDATA 'gcloud\application_default_credentials.json'
  if (-not (Test-Path -LiteralPath $adcPath)) {
    Write-Host 'Google ADC credentials가 없어 ADC OAuth 브라우저를 엽니다.'
    & $gcloudCandidates[0] auth application-default login
    if ($LASTEXITCODE -ne 0) { throw 'Google ADC OAuth 로그인이 취소되거나 실패했습니다.' }
  } else {
    Write-Host 'Google ADC credentials를 사용합니다. 별도의 gcloud 사용자 로그인을 요구하지 않습니다.'
  }
}

if (-not $SkipTerraform) {
  $tfvars = Join-Path $googleTerraform 'terraform.tfvars'
  $terraformArguments = @()
  if (Test-Path -LiteralPath $tfvars) {
    $terraformArguments = @('-var-file=terraform.tfvars')
  } else {
    Write-Host 'terraform.tfvars가 없어 gcloud에서 기본값을 조회합니다.'
    # ADC만 승인된 경우 gcloud 사용자 계정은 없을 수 있으므로
    # config/projects 조회를 시도하지 않고 사용자가 직접 입력하게 합니다.
    $defaultBootstrap = if ($env:GOOGLE_BOOTSTRAP_PROJECT_ID) { $env:GOOGLE_BOOTSTRAP_PROJECT_ID } else { '' }
    $defaultProjectId = "gdrive-share-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"
    $defaultBilling = if ($env:GOOGLE_BILLING_ACCOUNT) { $env:GOOGLE_BILLING_ACCOUNT } else { '' }
    $bootstrapProject = Read-Host "기존 Google bootstrap 프로젝트 ID [$defaultBootstrap]"
    $projectId = Read-Host "새 Google 프로젝트 ID [$defaultProjectId]"
    $projectName = Read-Host '프로젝트 표시 이름 [GDrive Share]'
    $billingAccount = Read-Host "Billing account ID [$defaultBilling]"
    $parentFolder = Read-Host 'Google Cloud parent folder ID (없으면 Enter)'
    if ([string]::IsNullOrWhiteSpace($bootstrapProject)) { $bootstrapProject = $defaultBootstrap }
    if ([string]::IsNullOrWhiteSpace($projectId)) { $projectId = $defaultProjectId }
    if ([string]::IsNullOrWhiteSpace($billingAccount)) { $billingAccount = $defaultBilling }
    if ([string]::IsNullOrWhiteSpace($bootstrapProject) -or [string]::IsNullOrWhiteSpace($projectId)) {
      throw 'bootstrap 프로젝트 ID와 새 프로젝트 ID는 필수입니다. ADC 로그인만 사용한 경우 기존 Google Cloud 프로젝트 ID를 직접 입력하세요.'
    }
    if ([string]::IsNullOrWhiteSpace($projectName)) { $projectName = 'GDrive Share' }
    $terraformArguments = @(
      "-var=google_bootstrap_project_id=$bootstrapProject",
      "-var=google_project_id=$projectId",
      "-var=google_project_name=$projectName",
      "-var=google_billing_account=$billingAccount",
      "-var=google_parent_folder_id=$parentFolder"
    )
  }

  terraform "-chdir=$googleTerraform" init
  if ($LASTEXITCODE -ne 0) { throw 'Terraform init이 실패했습니다.' }
  # API 키 생성은 ADC quota project가 필요하므로 프로젝트와 API를 먼저 만듭니다.
  terraform "-chdir=$googleTerraform" apply -auto-approve "-target=google_project.app" "-target=google_project_service.required" @terraformArguments
  if ($LASTEXITCODE -ne 0) { throw 'Google Cloud 프로젝트 또는 API 활성화가 실패했습니다.' }
  if (-not $env:GOOGLE_APPLICATION_CREDENTIALS -and $gcloudCandidates) {
    $quotaProject = terraform "-chdir=$googleTerraform" output -raw google_project_id
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($quotaProject)) { throw 'ADC quota project로 사용할 Google 프로젝트 ID를 조회하지 못했습니다.' }
    $env:GOOGLE_CLOUD_QUOTA_PROJECT = $quotaProject.Trim()
    & $gcloudCandidates[0] auth application-default set-quota-project $quotaProject
    if ($LASTEXITCODE -ne 0) { throw "ADC quota project 설정이 실패했습니다: $quotaProject" }
  }
  terraform "-chdir=$googleTerraform" apply -auto-approve @terraformArguments
  if ($LASTEXITCODE -ne 0) { throw 'Terraform apply가 실패했습니다.' }
}

$apiKey = terraform "-chdir=$googleTerraform" output -raw google_drive_api_key
if ($LASTEXITCODE -ne 0) { throw 'Terraform output 조회가 실패했습니다. 프로젝트 생성 상태를 확인하세요.' }
$projectId = terraform "-chdir=$googleTerraform" output -raw google_project_id
if ($LASTEXITCODE -ne 0) { throw 'Google Cloud 프로젝트 ID 조회가 실패했습니다.' }
Write-Host "Google Cloud 프로젝트 생성/확인 완료: $projectId"
Set-WorkerSecret 'GOOGLE_API_KEY' $apiKey

$consentUrl = "https://console.cloud.google.com/apis/credentials/consent?project=$projectId"
Write-Host ''
Write-Host 'Google OAuth 동의 화면 설정을 먼저 완료하세요:'
Write-Host $consentUrl
Start-Process $consentUrl
Write-Host '동의 화면 설정과 테스트 사용자 등록을 확인한 뒤 아래 OAuth Client 정보를 입력하세요.'

$clientId = ((Read-Host 'Google Web OAuth Client ID') -replace '^\uFEFF', '').Trim()
$clientSecret = ((Read-PlainSecret 'Google Web OAuth Client Secret') -replace '^\uFEFF', '').Trim()
$adminEmails = ((Read-Host '허용할 Google 관리자 이메일(여러 개는 쉼표로 구분)') -replace '^\uFEFF', '').Trim()
if ([string]::IsNullOrWhiteSpace($adminEmails)) { throw '허용할 Google 관리자 이메일이 필요합니다.' }
Set-WorkerSecret 'GOOGLE_CLIENT_ID' $clientId
Set-WorkerSecret 'GOOGLE_CLIENT_SECRET' $clientSecret
Set-WorkerSecret 'GOOGLE_ADMIN_EMAILS' $adminEmails

if (-not $SkipDeploy) {
  bun run deploy
}

$setupUrl = "$WorkerOrigin/setup"
Write-Host ''
Write-Host 'Google Console에 다음 Authorized redirect URI를 등록했는지 확인하세요:'
Write-Host "$WorkerOrigin/api/auth/google/callback"
Write-Host "허용 이메일 제한 Google 관리자 OAuth 시작 URL: $setupUrl"
Start-Process $setupUrl
