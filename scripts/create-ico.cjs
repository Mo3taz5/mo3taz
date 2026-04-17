const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createIco() {
  const logoPath = path.join(__dirname, '../logo.png');
  const outputPath = path.join(__dirname, '../build/icon.ico');
  
  const sizes = [16, 32, 48, 64, 128, 256];
  console.log('Creating icon sizes:', sizes);
  
  // Create resized versions
  const buffers = [];
  for (const size of sizes) {
    const buffer = await sharp(logoPath)
      .resize(size, size, { fit: 'fill' })
      .png()
      .toBuffer();
    buffers.push(buffer);
    console.log(`Created ${size}x${size}: ${buffer.length} bytes`);
  }
  
  // Use png2icons to create proper ICO
  const { execSync } = require('child_process');
  // Write 256x256 as source for png2icons
  await sharp(logoPath)
    .resize(256, 256, { fit: 'fill' })
    .png()
    .toFile(path.join(__dirname, '../build/icon-256.png'));
    
  execSync(`npx png2icons build/icon-256.png build/icon-new -ico -bc`, { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  
  // Replace old ICO
  fs.copyFileSync(path.join(__dirname, '../build/icon-new.ico'), outputPath);
  console.log('✓ ICO created:', outputPath);
}

createIco().catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});
