; Personalizaciones del instalador NSIS de World Craft.
;
; `customInstallMode` fuerza la instalación por usuario (LOCALAPPDATA), sin
; privilegios de administrador, y salta la página de selección de modo.
;
; `customUnInstall` se ejecuta al desinstalar, antes de borrar los binarios.
; Solo muestra el aviso cuando el desinstalador no corre en silencio; en modo
; silencioso (`/S`) no bloquea el proceso. El mensaje recuerda que `userData`
; no forma parte de la instalación y no se borra. No se usa
; `customUnInstallSection` para no añadir una página de componentes al
; desinstalador.

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customUnInstall
  IfSilent wcDataPreservedDone
  MessageBox MB_OK|MB_ICONINFORMATION "World Craft se va a desinstalar.$\r$\n$\r$\nTus mundos, mapas, fichas y copias de seguridad se conservan en:$\r$\n$APPDATA\World Craft$\r$\n$\r$\nSi quieres eliminarlos, borra esa carpeta manualmente." IDOK
  wcDataPreservedDone:
!macroend
