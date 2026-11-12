$ErrorActionPreference = 'Continue'

function New-WCIssue {
    param([hashtable]$Issue)

    $createdFile = Join-Path $PSScriptRoot 'issues-created.tsv'
    if (Test-Path $createdFile) {
        $created = @(Get-Content $createdFile -Encoding UTF8 | ForEach-Object { ($_ -split "`t")[0] })
        if ($created -contains $Issue.code) {
            Write-Host "SKIP $($Issue.code) (ya creada)"
            return
        }
    }

    $payload = @{
        title     = $Issue.title
        body      = $Issue.body
        milestone = [int]$Issue.milestone
        labels    = @($Issue.labels)
    } | ConvertTo-Json -Depth 6

    $tmp = [IO.Path]::GetTempFileName()
    [IO.File]::WriteAllText($tmp, $payload, (New-Object System.Text.UTF8Encoding($false)))

    $raw = & gh api 'repos/gonzalitojh/world-craft/issues' -X POST --input $tmp 2>&1
    $exit = $LASTEXITCODE
    Remove-Item $tmp -Force

    if ($exit -ne 0) {
        Write-Host "ERROR $($Issue.code): $raw" -ForegroundColor Red
        return
    }

    $resp = ($raw | Out-String) | ConvertFrom-Json
    $line = "$($Issue.code)`t$($resp.number)`t$($resp.html_url)"
    Add-Content -Path $createdFile -Value $line -Encoding UTF8
    Write-Host $line
}
