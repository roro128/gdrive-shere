$ErrorActionPreference = 'Stop'

$repoRoot = (git rev-parse --show-toplevel).Trim()
Set-Location -LiteralPath $repoRoot

$blockedPathPattern = '(?i)(^|[\\/])(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|.*\.tfstate(?:\..*)?|.*\.tfvars|.*\.(?:pem|key|p12|pfx|jks|keystore)|(?:credentials|service-account).*\.json|\.codex-.*|.*\.log)$'
$allowedExamplePattern = '(?i)(^|[\\/])(?:\.env\.example|.*\.tfvars\.example)$'
$trackedPaths = @(git ls-files)
$blockedPaths = @($trackedPaths | Where-Object {
    $_ -match $blockedPathPattern -and $_ -notmatch $allowedExamplePattern
})

$secretPatterns = [ordered]@{
    privateKey = 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'
    googleApiKey = 'AIza[0-9A-Za-z_-]{20,}'
    githubToken = 'gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}'
    openAiKey = 'sk-[A-Za-z0-9_-]{20,}'
    slackToken = 'xox[baprs]-[A-Za-z0-9-]{10,}'
    jwt = 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
}

$contentFindings = @()
foreach ($entry in $secretPatterns.GetEnumerator()) {
    $indexPaths = @(git grep --cached -I -l -E -e $entry.Value -- 2>$null)
    $worktreePaths = @(git grep -I -l -E -e $entry.Value -- 2>$null)
    $paths = @($indexPaths + $worktreePaths | Sort-Object -Unique)
    foreach ($path in $paths) {
        $contentFindings += '{0}: {1}' -f $entry.Key, $path
    }
}

if ($blockedPaths.Count -gt 0 -or $contentFindings.Count -gt 0) {
    Write-Error 'Public repository check failed.'
    if ($blockedPaths.Count -gt 0) {
        Write-Host 'Blocked tracked paths:'
        $blockedPaths | ForEach-Object { Write-Host "- $_" }
    }
    if ($contentFindings.Count -gt 0) {
        Write-Host 'High-confidence secret patterns:'
        $contentFindings | Sort-Object -Unique | ForEach-Object { Write-Host "- $_" }
    }
    exit 1
}

Write-Host ('Public repository check passed: {0} tracked paths inspected.' -f $trackedPaths.Count)
