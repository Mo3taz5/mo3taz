!macro customInstall
  ; Set the icon on the installed executable
  StrCpy $0 "$INSTDIR\Mo3taz.exe"
  nsExec::ExecToLog '"$INSTDIR\rcedit-x64.exe" "$0" --set-icon "$INSTDIR\resources\app.asar.unpacked\resources\icon.ico" --set-version-string ProductName "Mo3taz"'
  
  ; Copy GIF to app resources for use in UI
  SetOutPath "$INSTDIR\resources"
  File /oname=output.gif "${PROJECT_DIR}\output.gif"
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\hydralauncher-updater"
  ${endIf}
!macroend
