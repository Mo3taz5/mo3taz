const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function afterPack(context) {
  console.log('[AfterPack] Context keys:', Object.keys(context));
  console.log('[AfterPack] appOutDir:', context.appOutDir);
  console.log('[AfterPack] projectDir:', context.projectDir);
  
  const appOutDir = context.appOutDir;
  if (!appOutDir) {
    console.log('[AfterPack] No appOutDir, skipping');
    return;
  }
  
  // Find the exe in appOutDir
  const files = fs.readdirSync(appOutDir).filter(f => f.endsWith('.exe'));
  console.log('[AfterPack] Found executables:', files);
  
  const exeName = files.find(f => f.toLowerCase().includes('mo3taz')) || files[0];
  if (!exeName) {
    console.log('[AfterPack] No executable found, skipping');
    return;
  }
  
  const exePath = path.join(appOutDir, exeName);
  
  // Find icon
  const possibleIconPaths = [
    path.join(process.cwd(), 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    'D:\\sdk\\test\\hydra\\build\\icon.ico'
  ];
  
  let iconPath = possibleIconPaths.find(p => fs.existsSync(p));
  if (!iconPath) {
    console.log('[AfterPack] Icon not found in:', possibleIconPaths);
    return;
  }
  
  console.log('[AfterPack] EXE:', exePath);
  console.log('[AfterPack] ICO:', iconPath);
  
  try {
    const rceditPath = 'D:\\sdk\\test\\hydra\\rcedit-x64.exe';
    if (!fs.existsSync(rceditPath)) {
      console.log('[AfterPack] rcedit not found at:', rceditPath);
      return;
    }
    
    execSync(`"${rceditPath}" "${exePath}" --set-icon "${iconPath}" --set-version-string ProductName "Mo3taz" --set-version-string FileDescription "Mo3taz Launcher"`, { stdio: 'inherit' });
    console.log('[AfterPack] ✓ Icon embedded successfully!');
  } catch (error) {
    console.error('[AfterPack] ✗ Failed to embed icon:', error.message);
    throw error;
  }
}

module.exports = { default: afterPack };
