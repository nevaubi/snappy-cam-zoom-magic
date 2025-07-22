#!/usr/bin/env node
const { spawn } = require('child_process');
const waitOn = require('wait-on');

const isDev = process.env.NODE_ENV !== 'production';

async function startElectronDev() {
  if (!isDev) {
    console.error('This script is for development only');
    process.exit(1);
  }

  console.log('Starting Electron development environment...');

  // Start Vite dev server
  const viteProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
  });

  try {
    // Wait for Vite dev server to be ready
    console.log('Waiting for Vite dev server...');
    await waitOn({
      resources: ['http://localhost:8080'],
      delay: 1000,
      timeout: 30000
    });

    console.log('Vite dev server ready, starting Electron...');

    // Start Electron
    const electronProcess = spawn('electron', ['.'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        ELECTRON: 'true'
      }
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\nShutting down development environment...');
      viteProcess.kill();
      electronProcess.kill();
      process.exit(0);
    });

    electronProcess.on('close', () => {
      console.log('Electron process closed');
      viteProcess.kill();
      process.exit(0);
    });

    viteProcess.on('close', () => {
      console.log('Vite process closed');
      electronProcess.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start dev server:', error);
    viteProcess.kill();
    process.exit(1);
  }
}

startElectronDev();