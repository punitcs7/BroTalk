; BroTalk NSIS Installer Lifecycle Hooks
; Completely resolves the Windows Restart Manager / Antivirus (e.g. McAfee) lock race condition

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Preparing BroTalk update: closing any active instances..."
  nsExec::Exec 'taskkill /F /T /IM brotalk.exe'
  Pop $0
  nsExec::Exec 'taskkill /F /T /IM BroTalk.exe'
  Pop $0
  Sleep 500

  ; Rename active binary to avoid Restart Manager detecting antivirus scanner handles (e.g. McAfee)
  ; When the target binary is relocated, RmGetList detects 0 locks and installs without error.
  ${If} ${FileExists} "$INSTDIR\brotalk.exe"
    Delete "$INSTDIR\brotalk.exe.old"
    Rename "$INSTDIR\brotalk.exe" "$INSTDIR\brotalk.exe.old"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\BroTalk.exe"
    Delete "$INSTDIR\BroTalk.exe.old"
    Rename "$INSTDIR\BroTalk.exe" "$INSTDIR\BroTalk.exe.old"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  Delete /REBOOTOK "$INSTDIR\brotalk.exe.old"
  Delete /REBOOTOK "$INSTDIR\BroTalk.exe.old"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec 'taskkill /F /T /IM brotalk.exe'
  Pop $0
  nsExec::Exec 'taskkill /F /T /IM BroTalk.exe'
  Pop $0
  Sleep 500
  ${If} ${FileExists} "$INSTDIR\brotalk.exe"
    Delete "$INSTDIR\brotalk.exe.old"
    Rename "$INSTDIR\brotalk.exe" "$INSTDIR\brotalk.exe.old"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\BroTalk.exe"
    Delete "$INSTDIR\BroTalk.exe.old"
    Rename "$INSTDIR\BroTalk.exe" "$INSTDIR\BroTalk.exe.old"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete /REBOOTOK "$INSTDIR\brotalk.exe.old"
  Delete /REBOOTOK "$INSTDIR\BroTalk.exe.old"
!macroend
