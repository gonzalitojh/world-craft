# Verificación manual de instalación, actualización y desinstalación.
#
# Este script NO se ejecuta en CI ni en las pruebas automáticas: instala,
# reinstala y desinstala World Craft en la máquina del usuario. Debe ejecutarse
# a mano cuando se prepare un release, aceptando el aviso de SmartScreen.
#
# Uso (PowerShell, desde la raíz del repositorio):
#   .\scripts\verify-install.ps1 `
#     -InstallerPath .\release\world-craft-0.1.0-setup.exe `
#     -AcceptInstallTest
#
# Comprueba:
#   1. Hashes de %APPDATA%\World Craft antes de tocar nada.
#   2. Instalación silenciosa en %LOCALAPPDATA%\Programs\World Craft.
#   3. Arranque del ejecutable y presencia de asar, app-update.yml, licencias y
#      binarios nativos desempaquetados.
#   4. Reinstalación/actualización y hashes de datos, assets y copias intactos.
#   5. Desinstalación silenciosa y hashes de nuevo intactos.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,

  # Instalador de una versión posterior. Si se omite, el script reinstala el
  # mismo artefacto; con él se prueba una actualización real entre versiones.
  [string]$UpdateInstallerPath,

  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\World Craft'),

  [string]$DataDir = (Join-Path $env:APPDATA 'World Craft'),

  [int]$LaunchWaitSeconds = 10,

  [switch]$SkipLaunch,

  [switch]$AcceptInstallTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $AcceptInstallTest) {
  throw 'Este script instala y desinstala la aplicación. Repite con -AcceptInstallTest para confirmarlo.'
}

if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
  throw "No existe el instalador: $InstallerPath"
}

if ($UpdateInstallerPath -and -not (Test-Path -LiteralPath $UpdateInstallerPath -PathType Leaf)) {
  throw "No existe el instalador de actualización: $UpdateInstallerPath"
}

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$updateInstaller = if ($UpdateInstallerPath) {
  (Resolve-Path -LiteralPath $UpdateInstallerPath).Path
} else {
  $null
}
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$message) {
  $script:failures.Add($message)
  Write-Host "FALLO: $message" -ForegroundColor Red
}

function Get-TreeHashes([string]$root) {
  $hashes = @{}

  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    return $hashes
  }

  Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      # Archivos volátiles del ciclo de vida de Electron: desaparecen al
      # cerrar la aplicación y no forman parte de los datos del usuario.
      $_.Name -notin @('lockfile', 'SingletonLock', 'SingletonCookie', 'SingletonSocket')
    } |
    Sort-Object FullName |
    ForEach-Object {
      $relative = $_.FullName.Substring($root.Length).TrimStart('\', '/')

      try {
        $hashes[$relative] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256 -ErrorAction Stop).Hash
      } catch {
        # Un archivo que se borra durante el recorrido no se puede comparar.
      }
    }

  return $hashes
}

function Compare-TreeHashes([string]$label, [hashtable]$before, [hashtable]$after) {
  foreach ($key in $before.Keys) {
    if (-not $after.ContainsKey($key)) {
      Add-Failure "$label perdió el archivo $key."
      continue
    }

    if ($before[$key] -ne $after[$key]) {
      Add-Failure "$label modificó el archivo $key."
    }
  }
}

function Invoke-Silent([string]$file, [string[]]$arguments) {
  $process = Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru

  if ($process.ExitCode -ne 0) {
    Add-Failure "$file terminó con código $($process.ExitCode)."
  }
}

$dataBefore = Get-TreeHashes $DataDir
Write-Host "Datos antes de instalar: $($dataBefore.Count) archivos en $DataDir."

Write-Host 'Instalando en modo silencioso...'
Invoke-Silent $installer @('/S')

$exe = Join-Path $InstallDir 'World Craft.exe'

if (-not $InstallDir.StartsWith($env:LOCALAPPDATA, [System.StringComparison]::OrdinalIgnoreCase)) {
  Add-Failure "La instalación no está bajo LOCALAPPDATA: $InstallDir"
}

if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  Add-Failure "No se encontró el ejecutable instalado en $exe."
} else {
  foreach ($relative in @(
      'resources\app.asar',
      'resources\app-update.yml',
      'LICENSE',
      'THIRD-PARTY-NOTICES.md',
      'licenses\sharp-LICENSE.txt',
      'licenses\img-sharp-win32-LICENSE.txt',
      'licenses\libvips-LICENSE.txt',
      'licenses\gpl-3.0.txt',
      'licenses\electron-updater-LICENSE.txt'
    )) {
    if (-not (Test-Path -LiteralPath (Join-Path $InstallDir $relative) -PathType Leaf)) {
      Add-Failure "Falta $relative en la instalación."
    }
  }

  $unpackedDir = Join-Path $InstallDir 'resources\app.asar.unpacked'

  if (-not (Test-Path -LiteralPath $unpackedDir -PathType Container)) {
    Add-Failure 'Falta resources\app.asar.unpacked en la instalación.'
  } else {
    $native = @(Get-ChildItem -LiteralPath $unpackedDir -Recurse -File -Filter '*.node' -ErrorAction SilentlyContinue)

    if ($native.Count -lt 2) {
      Add-Failure 'No hay al menos dos binarios .node desempaquetados.'
    }

    if (-not (Test-Path -LiteralPath (Join-Path $unpackedDir 'node_modules\better-sqlite3\prebuilds\win32-x64.node') -PathType Leaf)) {
      Add-Failure 'Falta el prebuild win32-x64 de better-sqlite3.'
    }

    $sharpX64 = @(Get-ChildItem -LiteralPath (Join-Path $unpackedDir 'node_modules\@img\sharp-win32-x64') -Recurse -File -Filter '*.node' -ErrorAction SilentlyContinue)

    if ($sharpX64.Count -eq 0) {
      Add-Failure 'Falta el binario nativo de sharp para win32-x64.'
    }
  }
}

$perUserKey = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
  Get-ItemProperty -ErrorAction SilentlyContinue |
  Where-Object {
    $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -like 'World Craft*'
  }

if (-not $perUserKey) {
  Add-Failure 'No hay una entrada de desinstalación por usuario (HKCU).'
}

$perMachineKey = Get-ChildItem 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
  Get-ItemProperty -ErrorAction SilentlyContinue |
  Where-Object {
    $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -like 'World Craft*'
  }

if ($perMachineKey) {
  Add-Failure 'La instalación se registró para todos los usuarios (HKLM); debería ser por usuario.'
}

$dataAfterInstall = Get-TreeHashes $DataDir
Compare-TreeHashes 'La instalación' $dataBefore $dataAfterInstall

if ($updateInstaller) {
  Write-Host 'Actualizando a la versión nueva...'
  Invoke-Silent $updateInstaller @('/S')
} else {
  Write-Host 'Reinstalando sobre la misma instalación...'
  Invoke-Silent $installer @('/S')
}

$dataAfterReinstall = Get-TreeHashes $DataDir
Compare-TreeHashes 'La reinstalación' $dataBefore $dataAfterReinstall

if (-not $SkipLaunch -and (Test-Path -LiteralPath $exe -PathType Leaf)) {
  Write-Host 'Arrancando la aplicación instalada...'
  $app = Start-Process -FilePath $exe -PassThru
  Start-Sleep -Seconds $LaunchWaitSeconds

  if ($app.HasExited) {
    Add-Failure "La aplicación terminó al arrancar con código $($app.ExitCode)."
  } else {
    Stop-Process -Id $app.Id -Force
  }
}

# Abrir la aplicación escribe en su base y en sus cachés; la desinstalación se
# compara contra el estado posterior al arranque, no contra el inicial.
$dataBeforeUninstall = Get-TreeHashes $DataDir

$uninstaller = Join-Path $InstallDir 'Uninstall World Craft.exe'

if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
  Add-Failure "No se encontró el desinstalador en $uninstaller."
} else {
  Write-Host 'Desinstalando en modo silencioso...'
  Invoke-Silent $uninstaller @('/S')

  Start-Sleep -Seconds 2

  if (Test-Path -LiteralPath $exe -PathType Leaf) {
    Add-Failure 'El ejecutable sigue presente después de desinstalar.'
  }
}

$dataAfterUninstall = Get-TreeHashes $DataDir
Compare-TreeHashes 'La desinstalación' $dataBeforeUninstall $dataAfterUninstall

if ($failures.Count -gt 0) {
  Write-Host ''
  Write-Host "verify-install: $($failures.Count) fallos." -ForegroundColor Red

  foreach ($failure in $failures) {
    Write-Host "- $failure"
  }

  exit 1
}

Write-Host ''
Write-Host 'verify-install correcto: instalar, reinstalar y desinstalar no tocaron los datos.' -ForegroundColor Green
Write-Host "Datos conservados en: $DataDir"
