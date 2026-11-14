<#
.SYNOPSIS
    Crea o actualiza los rulesets de protección de ramas de World Craft.

.DESCRIPTION
    Gestiona por nombre los rulesets `protect-dev` y `protect-main` mediante
    GitHub CLI. Las reglas son: prohibir borrado, prohibir force push y exigir
    Pull Request con 0 aprobaciones y resolución de hilos.

    - `protect-dev`: sin bypass.
    - `protect-main`: bypass del propietario del repositorio para promover
      `dev` a `main`.

    No configura required status checks: llegan con la issue #6.

    Es idempotente: consulta los rulesets existentes y hace PUT si encuentra el
    nombre o POST si no existe.

.PARAMETER DryRun
    Imprime los payloads y el estado actual sin aplicar cambios.

.PARAMETER Repo
    Repositorio en formato owner/name. Si se omite, usa el repo actual de gh.

.EXAMPLE
    .\scripts\set-branch-protection.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [string]$Repo
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'No se ha encontrado GitHub CLI (gh) en el PATH.'
}

if (-not $Repo) {
    $Repo = (gh repo view --json nameWithOwner --jq '.nameWithOwner').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $Repo) {
        throw 'No se pudo determinar el repositorio actual. Usa -Repo owner/name.'
    }
}

Write-Host "Repositorio: $Repo"

# Identificador del propietario para el bypass de main.
# Se exige que la cuenta autenticada sea la propietaria del repositorio: si no,
# el bypass se concedería al actor equivocado.
$ownerLogin = (gh api user --jq '.login').Trim()
$ownerIdTexto = (gh api user --jq '.id').Trim()
if ($LASTEXITCODE -ne 0 -or $ownerIdTexto -notmatch '^\d+$' -or -not $ownerLogin) {
    throw 'No se pudo obtener el id del propietario con `gh api user --jq .id`.'
}
$repoOwner = ($Repo -split '/')[0]
if ($ownerLogin -ne $repoOwner) {
    throw "La cuenta autenticada ('$ownerLogin') no es la propietaria del repositorio ('$repoOwner'). El bypass de main debe pertenecer al propietario."
}
$ownerId = [long]$ownerIdTexto

function New-RulesetPayload {
    param(
        [string]$Name,
        [string]$Ref,
        [array]$BypassActors
    )

    return [ordered]@{
        name        = $Name
        target      = 'branch'
        enforcement = 'active'
        conditions  = [ordered]@{
            ref_name = [ordered]@{
                include = @($Ref)
                exclude = @()
            }
        }
        rules       = @(
            [ordered]@{ type = 'deletion' },
            [ordered]@{ type = 'non_fast_forward' },
            [ordered]@{
                type       = 'pull_request'
                parameters = [ordered]@{
                    required_approving_review_count   = 0
                    dismiss_stale_reviews_on_push     = $false
                    require_code_owner_review         = $false
                    require_last_push_approval        = $false
                    required_review_thread_resolution = $true
                }
            }
        )
        bypass_actors = $BypassActors
    }
}

$bypassMain = @(
    [ordered]@{
        actor_id    = $ownerId
        actor_type  = 'User'
        bypass_mode = 'always'
    }
)

$objetivos = @(
    [ordered]@{
        Name    = 'protect-dev'
        Payload = New-RulesetPayload -Name 'protect-dev' -Ref 'refs/heads/dev' -BypassActors @()
    },
    [ordered]@{
        Name    = 'protect-main'
        Payload = New-RulesetPayload -Name 'protect-main' -Ref 'refs/heads/main' -BypassActors $bypassMain
    }
)

# Leer rulesets existentes una sola vez.
$rulesetsExistentes = @()
$eapAnterior = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $salidaLista = gh api --paginate "repos/$Repo/rulesets" --jq '.[] | @json' 2>$null
    $codigoLista = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $eapAnterior
}

if ($codigoLista -ne 0) {
    if ($DryRun) {
        Write-Warning 'No se pudieron leer los rulesets actuales (p. ej. repositorio privado en GitHub Free). Se simula la creación.'
    }
    else {
        throw "No se pudieron leer los rulesets de $Repo."
    }
}
elseif ($salidaLista) {
    # --jq '.[] | @json' devuelve un objeto JSON compacto por línea. Se convierte
    # cada línea por separado para que el array no se anide como un solo elemento.
    $rulesetsExistentes = @($salidaLista | ForEach-Object { $_ | ConvertFrom-Json })
}

foreach ($objetivo in $objetivos) {
    $nombre = $objetivo.Name
    $payload = $objetivo.Payload
    $existente = $rulesetsExistentes | Where-Object { $_.name -eq $nombre } | Select-Object -First 1

    if ($DryRun) {
        $modo = if ($existente) { "actualizar (id $($existente.id))" } else { 'crear' }
        Write-Host ''
        Write-Host "[DryRun] $nombre -> $modo"
        $payload | ConvertTo-Json -Depth 10
        continue
    }

    $json = $payload | ConvertTo-Json -Depth 10
    if ($existente) {
        Write-Host "Actualizando ruleset '$nombre' (id $($existente.id))..."
        $json | gh api --method PUT "repos/$Repo/rulesets/$($existente.id)" --input - | Out-Null
    }
    else {
        Write-Host "Creando ruleset '$nombre'..."
        $json | gh api --method POST "repos/$Repo/rulesets" --input - | Out-Null
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Fallo al aplicar el ruleset '$nombre' (código $LASTEXITCODE)."
    }
}

# Verificación final (solo en modo real).
if ($DryRun) {
    Write-Host ''
    Write-Host 'DryRun completado: no se ha aplicado ningún cambio.'
    return
}

Write-Host ''
Write-Host 'Verificación de rulesets:'
$salidaVerificacion = gh api --paginate "repos/$Repo/rulesets" --jq '.[] | @json'
if ($LASTEXITCODE -ne 0) {
    throw "No se pudieron verificar los rulesets de $Repo."
}
$verificacion = @($salidaVerificacion | ForEach-Object { $_ | ConvertFrom-Json })

foreach ($nombre in @('protect-dev', 'protect-main')) {
    $resumen = $verificacion | Where-Object { $_.name -eq $nombre } | Select-Object -First 1
    if (-not $resumen) {
        Write-Warning "  - ${nombre}: no encontrado tras la aplicación."
        continue
    }

    $detalle = gh api "repos/$Repo/rulesets/$($resumen.id)" | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo leer el detalle del ruleset '$nombre'."
    }

    $reglas = (@($detalle.rules) | ForEach-Object { $_.type }) -join ', '
    $actoresBypass = @($detalle.bypass_actors | ForEach-Object { "$($_.actor_type):$($_.actor_id)" })

    if ($nombre -eq 'protect-dev' -and $actoresBypass.Count -gt 0) {
        Write-Warning "  - ${nombre}: no debería tener bypass y tiene $($actoresBypass -join ', ')."
    }
    if ($nombre -eq 'protect-main') {
        $esperado = "User:$ownerId"
        if ($actoresBypass.Count -ne 1 -or $actoresBypass[0] -ne $esperado) {
            Write-Warning "  - ${nombre}: bypass esperado '$esperado' y encontrado '$($actoresBypass -join ', ')'."
        }
    }

    $bypassTexto = if ($actoresBypass.Count -gt 0) { $actoresBypass -join ', ' } else { 'ninguno' }
    Write-Host "  - $nombre (id $($resumen.id)): enforcement=$($detalle.enforcement); reglas=$reglas; bypass=$bypassTexto"
}

Write-Host 'Protección de ramas aplicada.'
