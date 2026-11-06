; BroTalk NSIS Installer Lifecycle Hooks
; Solves the Windows Restart Manager / NSIS race condition during in-app updates

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Preparing BroTalk update: closing any active instances..."
  Sleep 1000
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM BroTalk.exe'
  Pop $0
  Sleep 1000
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM BroTalk.exe'
  Pop $0
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
