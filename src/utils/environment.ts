// Environment detection utilities for unified web/desktop app

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      recording: {
        start: (config: any) => Promise<any>;
        stop: () => Promise<any>;
        onProgress: (callback: (data: any) => void) => void;
        onComplete: (callback: (data: any) => void) => void;
        onError: (callback: (error: string) => void) => void;
      };
      files: {
        showSaveDialog: (options: any) => Promise<any>;
        showOpenDialog: (options: any) => Promise<any>;
      };
    };
  }
}

/**
 * Check if the app is running in Electron (desktop mode)
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
};

/**
 * Check if the app is running in web mode
 */
export const isWeb = (): boolean => {
  return !isElectron();
};

/**
 * Get the current platform
 */
export const getPlatform = async (): Promise<string> => {
  if (isElectron()) {
    return await window.electronAPI!.getPlatform();
  }
  return navigator.platform;
};

/**
 * Get the app version
 */
export const getAppVersion = async (): Promise<string> => {
  if (isElectron()) {
    return await window.electronAPI!.getVersion();
  }
  return 'web';
};

/**
 * Check if native screen recording is available
 */
export const hasNativeRecording = (): boolean => {
  return isElectron() && !!window.electronAPI?.recording;
};

/**
 * Check if native file dialogs are available
 */
export const hasNativeFileDialogs = (): boolean => {
  return isElectron() && !!window.electronAPI?.files;
};

/**
 * Get environment-specific features
 */
export const getEnvironmentFeatures = () => {
  return {
    isElectron: isElectron(),
    isWeb: isWeb(),
    hasNativeRecording: hasNativeRecording(),
    hasNativeFileDialogs: hasNativeFileDialogs(),
    supportsWebRTC: !isElectron() || navigator.mediaDevices !== undefined,
    supportsFileSystemAPI: 'showSaveFilePicker' in window,
    supportsScreenCapture: navigator.mediaDevices?.getDisplayMedia !== undefined
  };
};

/**
 * Development helper to log environment info
 */
export const logEnvironmentInfo = async () => {
  if (process.env.NODE_ENV === 'development') {
    const features = getEnvironmentFeatures();
    const platform = await getPlatform();
    const version = await getAppVersion();
    
    console.log('Environment Info:', {
      platform,
      version,
      features
    });
  }
};