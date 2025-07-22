#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function buildElectron() {
  try {
    console.log('Building Electron application...');

    // Clean previous builds
    console.log('Cleaning previous builds...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true });
    }
    if (fs.existsSync('dist-electron')) {
      fs.rmSync('dist-electron', { recursive: true });
    }

    // Build Vite app for production
    console.log('Building Vite application...');
    await runCommand('npm', ['run', 'build'], {
      env: {
        ...process.env,
        ELECTRON: 'true',
        NODE_ENV: 'production'
      }
    });

    // Build Electron app
    console.log('Building Electron application...');
    await runCommand('electron-builder', ['--publish=never']);

    console.log('✅ Electron build completed successfully!');
    console.log('📁 Built files are in the dist-electron directory');

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

buildElectron();