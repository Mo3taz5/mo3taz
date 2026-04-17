# 🎨 Custom Installer Assets Guide

To make your installer truly modern and professional, create these image files and place them in the `build/` folder:

## Required Images

### 1. Header Banner
- **File:** `build/installer-header.bmp`
- **Size:** 150x57 pixels
- **Format:** BMP (24-bit)
- **Purpose:** Shown at the top of the installer wizard
- **Design:** Your logo or branding on dark background (#0f0f14)

### 2. Sidebar Image  
- **File:** `build/installer-sidebar.bmp`
- **Size:** 164x314 pixels
- **Format:** BMP (24-bit)
- **Purpose:** Shown on the welcome/finish pages
- **Design:** App screenshot, logo, or promotional graphic

### 3. Icon (Already exists)
- **File:** `build/icon.ico`
- **Size:** 256x256 pixels (multi-resolution ICO)
- **Purpose:** Application and installer icon

## Design Recommendations

### Color Palette (Dark Theme)
- Background: `#0f0f14` or `#14141c`
- Accent: `#4d7cff` (Neon Blue)
- Text: `#f0f0f5` (White)
- Muted: `#e0e0e8` (Light Gray)

### Modern Design Tips
1. **Keep it clean:** Minimal design with lots of negative space
2. **Use gradients:** Subtle gradients add depth
3. **Brand consistency:** Use your app's logo and colors
4. **High quality:** Avoid pixelated or blurry images
5. **Test at 100%:** View images at actual size before including

## How to Enable Custom Images

Once you have the images ready, edit `installer.nsh` and uncomment these lines:

```nsis
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "build\installer-header.bmp"
!define MUI_HEADERIMAGE_TRANSITIONS
!define MUI_WELCOMEFINISHPAGE_BITMAP "build\installer-sidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "build\installer-sidebar.bmp"
```

## Creating BMP Files

### Using Photoshop/GIMP:
1. Create your image at the specified dimensions
2. Go to File > Save As
3. Choose "BMP" format
4. Select 24-bit color depth
5. Save to the `build/` folder

### Using Online Tools:
- Convert PNG to BMP: https://cloudconvert.com/png-to-bmp
- Resize images: https://www.iloveimg.com/resize-image

## Example Design Layout

### Header (150x57):
```
┌─────────────────────────────┐
│ [Logo] ꧁MO3TAZ꧂ Launcher   │
└─────────────────────────────┘
```

### Sidebar (164x314):
```
┌──────────────┐
│              │
│   [App Logo  │
│    or Hero   │
│    Image]    │
│              │
│  Modern Game │
│   Launcher   │
│              │
└──────────────┘
```

## Alternative: Ultra-Modern Installer

If you want a **completely custom UI** (not possible with NSIS alone), consider:

1. **InnoSetup** - Better theming support
2. **Advanced Installer** - Professional modern UI
3. **Custom Electron Installer** - Build your own with web technologies

For now, the NSIS installer includes:
✅ High-DPI support (no blurry text)
✅ Professional page structure
✅ Custom branding text
✅ Registry entries
✅ Start Menu shortcuts
✅ Uninstaller
✅ Modern page descriptions

---

**Current Status:** Functional and clean installer with proper dark theme configuration.
**Next Step:** Add custom images for maximum visual impact!
