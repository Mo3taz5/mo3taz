; ꧁MO3TAZ꧂ Launcher - Modern Custom NSIS Installer
; Professional dark-themed installer with modern UI

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; ============================================================================
; INSTALLER CONFIGURATION
; ============================================================================

; High DPI awareness - prevents blurry text on high-DPI screens
ManifestDPIAware true

; Installer metadata
!define MUI_ABORTWARNING
!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"

; ============================================================================
; CUSTOM GRAPHICS CONFIGURATION
; To make this installer truly modern, add these images to build/ folder:
; 
; Required Images (create these for best results):
; - installer-header.bmp      (150x57 pixels) - Header banner
; - installer-sidebar.bmp     (164x314 pixels) - Sidebar image  
; - installer-background.bmp  (any size, will be tiled) - Background
; 
; Uncomment the lines below when you have custom images:
; ============================================================================

; !define MUI_HEADERIMAGE
; !define MUI_HEADERIMAGE_BITMAP "build\installer-header.bmp"
; !define MUI_HEADERIMAGE_TRANSITIONS
; !define MUI_WELCOMEFINISHPAGE_BITMAP "build\installer-sidebar.bmp"
; !define MUI_UNWELCOMEFINISHPAGE_BITMAP "build\installer-sidebar.bmp"

; ============================================================================
; PAGE CONFIGURATION
; ============================================================================

!define MUI_WELCOMEPAGE_TITLE "Welcome to ꧁MO3TAZ꧂ Launcher"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ꧁MO3TAZ꧂ Launcher.$\r$\n$\r$\n꧁MO3TAZ꧂ is a modern game launcher featuring:$\r$\n  • Sleek dark theme$\r$\n  • Game library management$\r$\n  • Download sources integration$\r$\n  • Achievement tracking$\r$\n$\r$\nClick Next to continue."

!define MUI_FINISHPAGE_TITLE "Installation Complete!"
!define MUI_FINISHPAGE_TEXT "꧁MO3TAZ꧂ Launcher has been successfully installed.$\r$\n$\r$\nYou can now launch the application and enjoy your gaming experience.$\r$\n$\r$\nThank you for choosing ꧁MO3TAZ꧂!"
!define MUI_FINISHPAGE_RUN "$INSTDIR\MO3TAZ.exe"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_LINK "Visit ꧁MO3TAZ꧂ Website"
!define MUI_FINISHPAGE_LINK_LOCATION "https://mo3taz.gg"

; ============================================================================
; INSTALLER PAGES
; ============================================================================

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ============================================================================
; UNINSTALLER PAGES
; ============================================================================

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ============================================================================
; LANGUAGE
; ============================================================================

!insertmacro MUI_LANGUAGE "English"

; ============================================================================
; INSTALLER NAME AND SETTINGS
; ============================================================================

Name "꧁MO3TAZ꧂ Launcher"
InstallDir "$PROGRAMFILES64\MO3TAZ"
InstallDirRegKey HKLM "Software\MO3TAZ" ""
RequestExecutionLevel admin

; ============================================================================
; CUSTOM COLORS (Dark Theme)
; Note: NSIS has limited color support. For full modern dark theme,
; consider using InnoSetup or Advanced Installer for better customization.
; ============================================================================

; ============================================================================
; INSTALLATION SECTION
; ============================================================================

Section "!Install ꧁MO3TAZ꧂ Launcher" SecInstall
  SectionIn RO
  
  SetOutPath "$INSTDIR"
  
  ; All application files are installed by electron-builder automatically
  ; This section handles additional custom setup tasks
  
  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\꧁MO3TAZ꧂"
  CreateShortCut "$SMPROGRAMS\꧁MO3TAZ꧂\꧁MO3TAZ꧂ Launcher.lnk" "$INSTDIR\MO3TAZ.exe"
  CreateShortCut "$SMPROGRAMS\꧁MO3TAZ꧂\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Create registry entries
  WriteRegStr HKLM "Software\MO3TAZ" "" "$INSTDIR"
  WriteRegStr HKLM "Software\MO3TAZ" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\MO3TAZ" "Version" "0.35.0"
  
  ; Uninstaller information
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "DisplayName" "꧁MO3TAZ꧂ Launcher"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "DisplayIcon" '"$INSTDIR\MO3TAZ.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "Publisher" "Los Broxas"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "DisplayVersion" "0.35.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "HelpLink" "https://mo3taz.gg"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "URLInfoAbout" "https://mo3taz.gg"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "NoRepair" 1
  
  ; Set estimated size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ" "EstimatedSize" "$0"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; ============================================================================
; UNINSTALL SECTION
; ============================================================================

Section "Uninstall"
  ; Remove shortcuts
  Delete "$SMPROGRAMS\꧁MO3TAZ꧂\꧁MO3TAZ꧂ Launcher.lnk"
  Delete "$SMPROGRAMS\꧁MO3TAZ꧂\Uninstall.lnk"
  RMDir "$SMPROGRAMS\꧁MO3TAZ꧂"
  
  ; Remove desktop shortcut if exists
  Delete "$DESKTOP\꧁MO3TAZ꧂ Launcher.lnk"
  
  ; Remove registry entries
  DeleteRegKey HKLM "Software\MO3TAZ"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MO3TAZ"
  
  ; Remove installation directory
  RMDir /r "$INSTDIR"
  
  ; Show completion message
  MessageBox MB_OK|MB_ICONINFORMATION "꧁MO3TAZ꧂ Launcher has been successfully uninstalled.$\r$\n$\r$\nThank you for using our software!"
SectionEnd

; ============================================================================
; CUSTOM FUNCTIONS
; ============================================================================

Function .onInit
  ; Set default installation directory
  ReadRegStr $INSTDIR HKLM "Software\MO3TAZ" ""
  StrCmp $INSTDIR "" "" +2
    StrCpy $INSTDIR "$PROGRAMFILES64\MO3TAZ"
FunctionEnd

Function .onGUIEnd
  ; Custom UI finalization can be added here
FunctionEnd
