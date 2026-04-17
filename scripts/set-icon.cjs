const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '../dist/win-unpacked/Mo3taz.exe');
const iconPath = path.join(__dirname, '../build/icon.ico');

if (!fs.existsSync(exePath)) {
  console.error('Executable not found:', exePath);
  process.exit(1);
}

if (!fs.existsSync(iconPath)) {
  console.error('Icon not found:', iconPath);
  process.exit(1);
}

try {
  console.log('Setting icon on executable...');
  execSync(`npx rcedit "${exePath}" --set-icon "${iconPath}" --set-version-string "ProductName" "Mo3taz"`, { stdio: 'inherit' });
  console.log('Icon set successfully!');
} catch (error) {
  console.error('Failed to set icon:', error.message);
  process.exit(1);
}
