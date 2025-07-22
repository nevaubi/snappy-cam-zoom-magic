# Package.json Updates Required

Since package.json is read-only in this environment, you'll need to manually add these configurations to your package.json file:

## 1. Add main entry point and homepage
```json
{
  "main": "electron/main.js",
  "homepage": "./"
}
```

## 2. Add new scripts
Add these scripts to your `"scripts"` section:

```json
{
  "scripts": {
    "electron:dev": "node scripts/electron-dev.js",
    "electron:build": "node scripts/build-electron.js",
    "electron:pack": "npm run build && electron-builder --publish=never",
    "electron:dist": "npm run build && electron-builder --publish=always",
    "dist": "electron-builder"
  }
}
```

## 3. Update build script (optional)
You can also update your existing build script to support both web and electron builds:

```json
{
  "scripts": {
    "build": "vite build",
    "build:web": "vite build",
    "build:electron": "cross-env ELECTRON=true vite build"
  }
}
```

## After making these changes:

1. **Development**: Run `npm run electron:dev` to start the Electron app in development mode
2. **Production Build**: Run `npm run electron:build` to create a distributable Electron app
3. **Web Build**: Continue using `npm run build` for web deployments

The app will work both as a web application and as a desktop Electron app with the same codebase!