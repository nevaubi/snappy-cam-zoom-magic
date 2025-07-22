// scripts/download-ffmpeg.js
const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('Downloading FFmpeg files...');

const files = [
  {
    url: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    dest: 'public/ffmpeg/ffmpeg-core.js'
  },
  {
    url: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
    dest: 'public/ffmpeg/ffmpeg-core.wasm'
  },
  {
    url: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.worker.js',
    dest: 'public/ffmpeg/ffmpeg-core.worker.js'
  }
];

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    const timeout = setTimeout(() => {
      file.destroy();
      reject(new Error(`Download timeout for ${url}`));
    }, 30000);
    
    https.get(url, (response) => {
      clearTimeout(timeout);
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded ${path.basename(destPath)}`);
        resolve();
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

async function downloadAll() {
  // Ensure directory exists
  const ffmpegDir = path.join(__dirname, '..', 'public', 'ffmpeg');
  if (!fs.existsSync(ffmpegDir)) {
    fs.mkdirSync(ffmpegDir, { recursive: true });
  }

  // Download all files
  for (const file of files) {
    const destPath = path.join(__dirname, '..', file.dest);
    try {
      await downloadFile(file.url, destPath);
    } catch (error) {
      console.error(`✗ Failed to download ${file.url}:`, error.message);
      process.exit(1);
    }
  }
  
  console.log('✓ All FFmpeg files downloaded successfully!');
}

downloadAll();