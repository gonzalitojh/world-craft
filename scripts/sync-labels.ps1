<#
.SYNOPSIS
    Sincroniza la taxonomía canónica de etiquetas de World Craft con GitHub.

.DESCRIPTION
    Crea o actualiza las 44 etiquetas del proyecto mediante
    `gh label create --force`. Es idempotente: se puede ejecutar varias veces.
    No borra etiquetas extra; al final las lista para revisarlas a mano.

.PARAMETER Repo
    Repositorio en formato owner/name. Si se omite, usa el repo actual de gh.

.EXAMPLE
    .\scripts\sync-labels.ps1

.EXAMPLE
    .\scripts\sync-labels.ps1 -Repo gonzalitojh/world-craft -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Repo
)

$ErrorActionPreference = 'Stop'

# Lista canónica de etiquetas. Debe coincidir con `gh label list` del repo.
$labels = @(
    @{ Name = 'ai'; Color = '5319e7'; Description = 'Lista para ser trabajada por los agentes de IA' },
    @{ Name = 'needs-decision'; Color = 'd93f0b'; Description = 'Requiere una decision del usuario antes de continuar' },
    @{ Name = 'future'; Color = 'cfd3d7'; Description = 'Backlog, fuera del MVP' },
    @{ Name = 'type: feature'; Color = '1d76db'; Description = 'Nueva funcionalidad' },
    @{ Name = 'type: bug'; Color = 'd73a4a'; Description = 'Error o comportamiento incorrecto' },
    @{ Name = 'type: chore'; Color = '6e7781'; Description = 'Tarea tecnica o de mantenimiento' },
    @{ Name = 'type: docs'; Color = '0075ca'; Description = 'Documentacion' },
    @{ Name = 'type: design'; Color = 'c5def5'; Description = 'Diseno visual, UX o sistema de diseno' },
    @{ Name = 'type: testing'; Color = 'bfd4f2'; Description = 'Pruebas, QA o accesibilidad' },
    @{ Name = 'type: refactor'; Color = 'fbca04'; Description = 'Refactor sin cambio funcional' },
    @{ Name = 'type: content'; Color = '0e8a16'; Description = 'Contenido editorial, plantillas o datos' },
    @{ Name = 'status: todo'; Color = 'ededed'; Description = 'Pendiente de empezar' },
    @{ Name = 'status: in-progress'; Color = 'fbca04'; Description = 'En implementacion' },
    @{ Name = 'status: needs-review'; Color = 'd4c5f9'; Description = 'Pendiente de revision' },
    @{ Name = 'status: blocked'; Color = 'd93f0b'; Description = 'Bloqueada por una decision o un fallo' },
    @{ Name = 'status: done'; Color = '0e8a16'; Description = 'Completada y verificada' },
    @{ Name = 'priority: p0'; Color = 'b60205'; Description = 'Bloqueante para el MVP' },
    @{ Name = 'priority: p1'; Color = 'd93f0b'; Description = 'Prioridad alta' },
    @{ Name = 'priority: p2'; Color = 'fbca04'; Description = 'Prioridad media' },
    @{ Name = 'priority: p3'; Color = 'cfd3d7'; Description = 'Prioridad baja' },
    @{ Name = 'size: s'; Color = 'c2e0c6'; Description = 'Menos de una sesion' },
    @{ Name = 'size: m'; Color = 'bfdadc'; Description = 'Una o dos sesiones' },
    @{ Name = 'size: l'; Color = 'fef2c0'; Description = 'Varias sesiones' },
    @{ Name = 'size: xl'; Color = 'f9d0c4'; Description = 'Epica; dividir si es posible' },
    @{ Name = 'area: agents'; Color = '6f42c1'; Description = 'Agentes de IA y flujo SDD' },
    @{ Name = 'area: architecture'; Color = '0052cc'; Description = 'Arquitectura y ADRs' },
    @{ Name = 'area: infra'; Color = '1d76db'; Description = 'Infraestructura, CI, despliegue y backups' },
    @{ Name = 'area: data'; Color = '006b75'; Description = 'Base de datos, modelo y migraciones' },
    @{ Name = 'area: auth'; Color = 'b60205'; Description = 'Autenticacion, permisos y cuentas' },
    @{ Name = 'area: worlds'; Color = '0e8a16'; Description = 'Mundos y dashboard' },
    @{ Name = 'area: entities'; Color = '2b8a3e'; Description = 'Entidades, fichas y relaciones' },
    @{ Name = 'area: graph'; Color = '5319e7'; Description = 'Vista de grafo' },
    @{ Name = 'area: maps'; Color = '1b7c83'; Description = 'Mapas vectoriales y marcadores' },
    @{ Name = 'area: writing'; Color = '8a4b08'; Description = 'Editor de novelas y exportacion' },
    @{ Name = 'area: game'; Color = 'a2eeef'; Description = 'Dados, tablas e inspiracion' },
    @{ Name = 'area: search'; Color = '0075ca'; Description = 'Busqueda y paleta de comandos' },
    @{ Name = 'area: docs'; Color = '6e7781'; Description = 'Documentacion y manual' },
    @{ Name = 'area: ui'; Color = 'c5def5'; Description = 'Interfaz, diseno y responsive' },
    @{ Name = 'area: security'; Color = 'd93f0b'; Description = 'Seguridad y privacidad' },
    @{ Name = 'area: qa'; Color = 'bfd4f2'; Description = 'Calidad, pruebas y rendimiento' },
    @{ Name = 'variant: default'; Color = 'ededed'; Description = 'Variante de modelo recomendada: default (sin variante explicita)' },
    @{ Name = 'variant: high'; Color = 'fbca04'; Description = 'Variante de modelo recomendada: high (esfuerzo alto)' },
    @{ Name = 'variant: low'; Color = 'c2e0c6'; Description = 'Variante de modelo recomendada: low (esfuerzo bajo)' },
    @{ Name = 'variant: max'; Color = 'b60205'; Description = 'Variante de modelo recomendada: max (esfuerzo maximo)' }
)

# 1. Comprobar duplicados en la lista canónica.
$duplicados = $labels | Group-Object -Property { $_.Name } | Where-Object { $_.Count -gt 1 }
if ($duplicados) {
    $nombres = ($duplicados | ForEach-Object { $_.Name }) -join ', '
    throw "La lista canónica contiene nombres duplicados: $nombres"
}

# 2. Resolver repositorio y comprobar gh.
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
Write-Host "Etiquetas canónicas: $($labels.Count)"

# 3. Crear o actualizar cada etiqueta.
$aplicadas = 0
$simuladas = 0
foreach ($label in $labels) {
    $target = "$Repo :: $($label.Name)"
    if ($PSCmdlet.ShouldProcess($target, 'Crear o actualizar etiqueta')) {
        gh label create $label.Name --repo $Repo --color $label.Color --description $label.Description --force
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo al crear o actualizar la etiqueta '$($label.Name)' (código $LASTEXITCODE)."
        }
        $aplicadas++
    }
    else {
        $simuladas++
    }
}

# 4. Listar etiquetas extra que no están en la lista canónica (no se borran).
$extra = @()
$eapAnterior = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $salidaEtiquetas = gh label list --repo $Repo --limit 200 --json name 2>$null
    $codigoEtiquetas = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $eapAnterior
}

if ($codigoEtiquetas -ne 0) {
    Write-Warning 'No se pudieron leer las etiquetas existentes para comprobar extras.'
}
else {
    $existentes = $salidaEtiquetas | ConvertFrom-Json
    $nombresCanonicos = $labels | ForEach-Object { $_.Name }
    $extra = @($existentes | Where-Object { $nombresCanonicos -notcontains $_.name } | ForEach-Object { $_.name } | Sort-Object)
}

# 5. Resumen.
Write-Host ''
Write-Host "Etiquetas aplicadas: $aplicadas"
if ($simuladas -gt 0) {
    Write-Host "Etiquetas simuladas (-WhatIf): $simuladas"
}
if ($extra.Count -gt 0) {
    Write-Host "Etiquetas extra en el repositorio (no se borran): $($extra.Count)"
    $extra | ForEach-Object { Write-Host "  - $_" }
}
else {
    Write-Host 'No hay etiquetas extra en el repositorio.'
}
Write-Host 'Sincronización completada.'
