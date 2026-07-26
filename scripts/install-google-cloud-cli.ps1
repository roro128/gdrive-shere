[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [switch]$Update,
  [switch]$SkipLogin,
  [switch]$LoginCloudflare
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

function Get-CommandPath([string]$Name, [string[]]$Candidates = @()) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  return $null
}

function Add-ToolDirectoryToPath([string]$Path) {
  $directory = Split-Path -Parent $Path
  if ($env:Path -notlike "*$directory*") {
    $env:Path = "$directory;$env:Path"
  }
}

function Require-WinGet {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw 'winget을 찾을 수 없습니다. App Installer를 설치한 뒤 다시 실행하세요.'
  }
  return $winget.Source
}

function Test-WinGet {
  return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Install-WinGetPackage([string]$Id, [string]$Label) {
  $winget = Require-WinGet
  Write-Host "$Label 설치 중..."
  & $winget install --id $Id --exact --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "$Label 설치에 실패했습니다."
  }
}

function Update-WinGetPackage([string]$Id, [string]$Label) {
  $winget = Require-WinGet
  Write-Host "$Label 갱신 중..."
  & $winget upgrade --id $Id --exact --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "$Label 갱신에 실패했습니다."
  }
}

function Add-UserPathEntry([string]$Directory) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $entries = @($userPath -split ';' | Where-Object { $_ })
  if ($entries -notcontains $Directory) {
    [Environment]::SetEnvironmentVariable('Path', (($entries + $Directory) -join ';'), 'User')
  }
}

function Install-BunFromOfficialScript {
  Write-Host '공식 설치 스크립트로 Bun 설치 중...'
  $installer = Join-Path $env:TEMP 'gdrive-share-bun-install.ps1'
  try {
    Invoke-WebRequest -Uri 'https://bun.sh/install.ps1' -OutFile $installer
    & powershell -NoProfile -ExecutionPolicy Bypass -File $installer
    if ($LASTEXITCODE -ne 0) { throw 'Bun 설치에 실패했습니다.' }
  } finally {
    Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
  }
}

function Install-TerraformFromOfficialArchive {
  $release = Invoke-RestMethod -Uri 'https://checkpoint-api.hashicorp.com/v1/check/terraform'
  $version = $release.current_version
  if ([string]::IsNullOrWhiteSpace($version)) { throw 'Terraform 최신 버전을 조회하지 못했습니다.' }

  $archiveName = "terraform_${version}_windows_amd64.zip"
  $baseUrl = "https://releases.hashicorp.com/terraform/$version"
  $temporaryArchive = Join-Path $env:TEMP $archiveName
  $temporaryChecksums = Join-Path $env:TEMP "terraform_${version}_SHA256SUMS"
  $installDirectory = Join-Path $env:LOCALAPPDATA "GDriveShare\tools\terraform\$version"
  $binDirectory = Join-Path $env:LOCALAPPDATA 'GDriveShare\tools\terraform\bin'

  Write-Host "공식 Terraform $version 설치 중..."
  try {
    Invoke-WebRequest -Uri "$baseUrl/$archiveName" -OutFile $temporaryArchive
    Invoke-WebRequest -Uri "$baseUrl/terraform_${version}_SHA256SUMS" -OutFile $temporaryChecksums
    $expected = (Get-Content -LiteralPath $temporaryChecksums | Where-Object { $_ -match "\\s$([regex]::Escape($archiveName))$" } | Select-Object -First 1) -split '\s+' | Select-Object -First 1
    $actual = (Get-FileHash -LiteralPath $temporaryArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($expected) -or $actual -ne $expected.ToLowerInvariant()) {
      throw '다운로드한 Terraform 아카이브의 SHA-256 검증에 실패했습니다.'
    }

    New-Item -ItemType Directory -Force -Path $installDirectory, $binDirectory | Out-Null
    Expand-Archive -LiteralPath $temporaryArchive -DestinationPath $installDirectory -Force
    Copy-Item -LiteralPath (Join-Path $installDirectory 'terraform.exe') -Destination (Join-Path $binDirectory 'terraform.exe') -Force
    Add-UserPathEntry $binDirectory
  } finally {
    Remove-Item -LiteralPath $temporaryArchive, $temporaryChecksums -Force -ErrorAction SilentlyContinue
  }
}

function Install-GcloudFromOfficialInstaller {
  $installer = Join-Path $env:TEMP 'GoogleCloudSDKInstaller.exe'
  Write-Host '공식 Google Cloud CLI 설치 프로그램 다운로드 중...'
  try {
    Invoke-WebRequest -Uri 'https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe' -OutFile $installer
    Start-Process -FilePath $installer -Wait
  } finally {
    Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
  }
}

function Get-WranglerPath {
  $candidates = @(
    (Join-Path $repo 'node_modules\.bin\wrangler.cmd'),
    (Join-Path $repo 'node_modules\.bin\wrangler.exe'),
    (Join-Path $repo 'node_modules\.bin\wrangler.bunx')
  )
  return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

$bunCandidates = @("$env:USERPROFILE\.bun\bin\bun.exe")
$terraformCandidates = @(
  "$env:LOCALAPPDATA\GDriveShare\tools\terraform\bin\terraform.exe",
  "$env:LOCALAPPDATA\Microsoft\WinGet\Links\terraform.exe"
)
$gcloudCandidates = @(
  "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$bun = Get-CommandPath 'bun' $bunCandidates
$terraform = Get-CommandPath 'terraform' $terraformCandidates
$gcloud = Get-CommandPath 'gcloud' $gcloudCandidates

if ($CheckOnly) {
  Write-Host 'Toolchain check (no changes):'
  Write-Host ("  Bun: " + $(if ($bun) { 'available' } else { 'missing' }))
  Write-Host ("  Terraform: " + $(if ($terraform) { 'available' } else { 'missing' }))
  Write-Host ("  Google Cloud CLI: " + $(if ($gcloud) { 'available' } else { 'missing' }))
  $wrangler = Get-WranglerPath
  Write-Host ("  Cloudflare Wrangler: " + $(if ($wrangler) { 'available' } else { 'missing (run without -CheckOnly)' }))
  exit 0
}

if (-not $bun) {
  if (Test-WinGet) {
    Install-WinGetPackage 'Oven-sh.Bun' 'Bun'
  } else {
    Install-BunFromOfficialScript
  }
  $bun = Get-CommandPath 'bun' $bunCandidates
  if (-not $bun) {
    throw 'Bun 설치를 찾을 수 없습니다. 새 PowerShell 창을 열고 다시 실행하세요.'
  }
} elseif ($Update) {
  if (Test-WinGet) {
    Update-WinGetPackage 'Oven-sh.Bun' 'Bun'
  } else {
    Install-BunFromOfficialScript
  }
}
Add-ToolDirectoryToPath $bun
& $bun --version

if (-not $terraform) {
  if (Test-WinGet) {
    Install-WinGetPackage 'Hashicorp.Terraform' 'Terraform'
  } else {
    Install-TerraformFromOfficialArchive
  }
  $terraform = Get-CommandPath 'terraform' $terraformCandidates
  if (-not $terraform) {
    throw 'Terraform 설치를 찾을 수 없습니다. 새 PowerShell 창을 열고 다시 실행하세요.'
  }
} elseif ($Update) {
  if (Test-WinGet) {
    Update-WinGetPackage 'Hashicorp.Terraform' 'Terraform'
  } else {
    Install-TerraformFromOfficialArchive
  }
}
Add-ToolDirectoryToPath $terraform
& $terraform version

if (-not $gcloud) {
  if (Test-WinGet) {
    Install-WinGetPackage 'Google.CloudSDK' 'Google Cloud CLI'
  } else {
    Install-GcloudFromOfficialInstaller
  }
  $gcloud = Get-CommandPath 'gcloud' $gcloudCandidates
  if (-not $gcloud) {
    throw 'Google Cloud CLI 설치를 찾을 수 없습니다. 새 PowerShell 창을 열고 다시 실행하세요.'
  }
} elseif ($Update) {
  if (Test-WinGet) {
    Update-WinGetPackage 'Google.CloudSDK' 'Google Cloud CLI'
  } else {
    & $gcloud components update --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Google Cloud CLI 갱신에 실패했습니다.' }
  }
}
Add-ToolDirectoryToPath $gcloud
& $gcloud --version

$wrangler = Get-WranglerPath
if (-not $wrangler) {
  Write-Host '프로젝트의 Cloudflare Wrangler 설치 중...'
  Push-Location $repo
  try {
    & $bun install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw '프로젝트 의존성 설치에 실패했습니다.' }
  } finally {
    Pop-Location
  }
}
$wrangler = Get-WranglerPath
if ($Update) {
  Write-Host 'Cloudflare Wrangler 갱신 중...'
  Push-Location $repo
  try {
    & $bun update wrangler --latest
    if ($LASTEXITCODE -ne 0) { throw 'Cloudflare Wrangler 갱신에 실패했습니다.' }
  } finally {
    Pop-Location
  }
}
$wrangler = Get-WranglerPath
if (-not $wrangler) {
  throw 'Cloudflare Wrangler를 찾을 수 없습니다.'
}
& $wrangler --version

if (-not $SkipLogin) {
  & $gcloud auth application-default login
  if ($LASTEXITCODE -ne 0) { throw 'Google ADC 로그인에 실패했습니다.' }
}

if ($LoginCloudflare) {
  & $wrangler login
  if ($LASTEXITCODE -ne 0) { throw 'Cloudflare 로그인에 실패했습니다.' }
} else {
  & $wrangler whoami
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Cloudflare 인증이 확인되지 않았습니다. API 토큰을 설정하거나 -LoginCloudflare로 로그인하세요.'
  }
}

Write-Host 'Bun, Terraform, Google Cloud CLI, Cloudflare Wrangler 준비가 완료되었습니다.'
