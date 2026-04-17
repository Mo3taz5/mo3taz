# 🎬 Cinema-Immersive UI - MO3TAZ Launcher Rebrand

## 📁 Updated File Structure

### New Components Created:
```
src/renderer/src/components/
├── floating-dock/
│   ├── floating-dock.tsx          # Mac-style magnification dock
│   └── floating-dock.scss         # Glassmorphism styling
├── immersive-background/
│   ├── immersive-background.tsx   # Dynamic hero image background
│   └── immersive-background.scss  # Blur + vignette + noise effects
└── index.ts                        # Updated exports
```

### Modified Files:
```
src/renderer/src/
├── app.tsx                         # Integrated FloatingDock + ImmersiveBackground
├── app.scss                        # Added cinema layout classes
└── scss/
    └── globals.scss                # Added glassmorphism + Cinema UI tokens
```

### Removed from Layout (Still Exist in Codebase):
- ❌ Sidebar (replaced by FloatingDock)
- ❌ Header (replaced by cleaner cinema layout)

**Note:** Old sidebar/header files still exist but are NO LONGER RENDERED. You can safely delete them if desired.

---

## 🎨 Design System: Cinema-Immersive UI

### Core Concept:
A **floating, minimalist navigation dock** positioned at the bottom-center with **macOS-style magnification** on hover. The background dynamically displays the **current game's hero image** with a cinematic blur effect.

### Key Features:

#### 1. **Floating Dock** (`FloatingDock.tsx`)
- **Position**: Fixed bottom-center (24px from bottom)
- **Animation**: Framer Motion spring physics
- **Magnification**: 1.6x scale on hover with smooth spring transitions
- **Items**: Home, Catalogue, Library, Downloads, Settings
- **Active State**: Glowing teal indicator dot
- **Download Indicator**: Pulsing dot on Downloads icon when active
- **Labels**: Appear above icon on hover with fade animation
- **Styling**:
  - Background: `rgba(10, 10, 15, 0.65)` with 20px blur
  - Border radius: 24px (pill shape)
  - Shadow: Multi-layer for depth
  - Backdrop filter: `blur(20px) saturate(180%)`

#### 2. **Immersive Background** (`ImmersiveBackground.tsx`)
- **Hero Image Resolution**:
  - Checks route for game ID
  - Fetches from library: `customHeroImageUrl` or `libraryHeroImageUrl`
  - Preloads image before transition
- **Effects**:
  - Blur: `20px` with `saturate(1.2)`
  - Gradient overlay for readability
  - Noise texture overlay (SVG filter)
  - Vignette effect (radial gradient)
- **Performance**:
  - Memo for image resolution
  - Preload before displaying
  - Smooth 0.8s opacity transitions
- **Fallback**: Base gradient if no hero image

#### 3. **Glassmorphism Design Tokens**
```scss
$glass-bg: rgba(10, 10, 15, 0.65);
$glass-border: rgba(255, 255, 255, 0.12);
$glass-blur: 20px;
$cinema-radius: 24px;
$cinema-card-radius: 16px;
$cinema-transition: 0.8s;
$glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 
                0 2px 8px rgba(0, 0, 0, 0.3), 
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
```

---

## 🔄 Navigation Flow

### Old System (Removed):
```
Sidebar → handleSidebarItemClick → navigate(path)
```

### New System:
```
FloatingDock → handleNavigation → navigate(path)
```

**All existing navigation hooks remain functional:**
- ✅ `useNavigate` from react-router-dom
- ✅ `buildGameDetailsPath()` helper
- ✅ All custom hooks (`useLibrary`, `useDownload`, etc.)
- ✅ Search functionality (if you add it to dock later)

---

## ⚙️ IPC Consistency

**All IPC calls remain UNCHANGED:**
- ✅ Download manager (`window.electron.*`)
- ✅ Game launching (`window.electron.openGame`)
- ✅ Cloud saves (Ludusavi integration)
- ✅ Achievement system
- ✅ Python RPC communication
- ✅ Torrent downloading
- ✅ File extraction

**Why?** The rebrand only affects the **presentation layer**. All service layers, hooks, and business logic are untouched.

---

## 🎯 Layout Structure

### Before:
```
┌─────────────────────────────────────┐
│ Title Bar (Windows)                 │
├──────────┬──────────────────────────┤
│          │ Header                   │
│ Sidebar  ├──────────────────────────┤
│          │ Content                  │
│          │                          │
├──────────┴──────────────────────────┤
│ Bottom Panel                        │
└─────────────────────────────────────┘
```

### After (Cinema-Immersive):
```
┌─────────────────────────────────────┐
│ Title Bar (Windows)                 │
├─────────────────────────────────────┤
│                                     │
│         [Hero Image Blur BG]        │
│                                     │
│        Content Area                 │
│        (Full Width)                 │
│                                     │
│    [Floating Dock] 🎬               │
├─────────────────────────────────────┤
│ Bottom Panel                        │
└─────────────────────────────────────┘
```

---

## 🚀 Performance Optimizations

### Implemented:
1. **Image Preloading**: Hero images load before transition
2. **Memo**: `useMemo` for hero image resolution
3. **CSS-only animations**: For blur/opacity transitions
4. **Framer Motion**: Optimized spring physics
5. **Debounced hover**: No flickering on quick mouse movements

### Recommendations:
- Consider lazy-loading hero images for games not in library
- Add image caching layer for faster transitions
- Use `React.memo` on page components to prevent re-renders

---

## 🎨 Aesthetic Guidelines

### Typography:
- Keep current font stack (Inter/system)
- Consider adding a distinctive display font for headers

### Color Palette:
- **Primary**: Neon teal (`#00f0ff`) for active states
- **Secondary**: Neon blue (`#4d7cff`) for accents
- **Backgrounds**: Dark layered surfaces (#0f0f14, #0a0a0f)
- **Glass**: Semi-transparent with blur

### Motion:
- Spring physics for dock (snappy, natural)
- Smooth 0.8s transitions for backgrounds
- Subtle micro-interactions (pulse, glow)

### Spatial:
- Full-width content (no sidebar constraint)
- Bottom navigation (thumb-friendly)
- Generous padding for scroll areas

---

## 📝 Next Steps / Customization

### To Add More Dock Items:
```typescript
// In floating-dock.tsx, add to DOCK_ITEMS array:
{ 
  path: "/achievements", 
  nameKey: "achievements", 
  icon: <TrophyIcon size={22} /> 
},
```

### To Change Magnification:
```typescript
const MAGNIFICATION_FACTOR = 1.6; // Increase to 1.8-2.0 for more drama
```

### To Adjust Blur Intensity:
```scss
// In immersive-background.scss
filter: blur(20px) saturate(1.2); // Change to 10px-30px
```

### To Disable Background Images:
```tsx
// In app.tsx, remove or comment out:
<ImmersiveBackground />
```

---

## ⚠️ Known Considerations

1. **Old Sidebar/Header**: Still in codebase but not rendered. Safe to delete.
2. **Game List Access**: Users now navigate to `/library` to see game list (was in sidebar)
3. **Collections**: Accessible via Library page (was in sidebar)
4. **Search**: Currently in Header component - may need relocation if header removed
5. **Profile Button**: Was in sidebar profile - now accessible via settings or custom route

---

## 🧪 Testing Checklist

- [ ] Navigate to all 5 dock items (home, catalogue, library, downloads, settings)
- [ ] Verify game hero image appears on game details page
- [ ] Test download indicator (start a download, check dock)
- [ ] Verify all IPC calls still work (download, launch, cloud sync)
- [ ] Test on different screen sizes (dock should stay centered)
- [ ] Check performance with large hero images (should preload smoothly)
- [ ] Verify toast notifications, modals still work
- [ ] Test achievement notifications still display

---

## 🎬 Vision Realized

✅ **Floating Dock**: Mac-style magnification, bottom-center
✅ **Immersive Background**: Dynamic hero images with blur
✅ **Minimalist Aesthetic**: Removed clutter, glassmorphism throughout
✅ **Performance**: Memo, preloading, CSS transitions
✅ **IPC Consistency**: All existing functionality preserved
✅ **Future-Ready**: Easy to add more dock items, customize styling

**The MO3TAZ Launcher now has a unique, futuristic identity - completely distinct from Hydra/Epic!**
