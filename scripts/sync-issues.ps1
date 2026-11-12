$ErrorActionPreference = 'Continue'
. "$PSScriptRoot\issue-helper.ps1"

# Carga las definiciones sin crear nada todavia.
$env:WC_SKIP_CREATE = '1'
$all = @()

. "$PSScriptRoot\issues-m0.ps1"
$all += $issues
. "$PSScriptRoot\issues-m1-m2.ps1"
$all += $issues
. "$PSScriptRoot\issues-m3-m4.ps1"
$all += $issues
. "$PSScriptRoot\issues-m5-backlog.ps1"
$all += $issues
. "$PSScriptRoot\issues-extra.ps1"
$all += $issues

Remove-Item Env:\WC_SKIP_CREATE -ErrorAction SilentlyContinue

$createdFile = Join-Path $PSScriptRoot 'issues-created.tsv'
$map = @{}
foreach ($line in Get-Content $createdFile -Encoding UTF8) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "`t"
    if ($parts.Count -ge 2) {
        $map[$parts[0]] = [int]$parts[1]
    }
}

function Update-WCIssue {
    param([int]$Number, [hashtable]$Issue)

    $payload = @{
        title     = $Issue.title
        body      = $Issue.body
        milestone = [int]$Issue.milestone
        labels    = @($Issue.labels)
    } | ConvertTo-Json -Depth 6

    $tmp = [IO.Path]::GetTempFileName()
    [IO.File]::WriteAllText($tmp, $payload, (New-Object System.Text.UTF8Encoding($false)))

    $raw = & gh api "repos/gonzalitojh/world-craft/issues/$Number" -X PATCH --input $tmp 2>&1
    $exit = $LASTEXITCODE
    Remove-Item $tmp -Force

    if ($exit -ne 0) {
        Write-Host "ERROR $($Issue.code) #${Number}: $raw" -ForegroundColor Red
        return $false
    }

    Write-Host "UPDATE $($Issue.code) #$Number"
    return $true
}

foreach ($issue in $all) {
    if ($map.ContainsKey($issue.code)) {
        Update-WCIssue -Number $map[$issue.code] -Issue $issue | Out-Null
    }
    else {
        New-WCIssue -Issue $issue
    }
}
