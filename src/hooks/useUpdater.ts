import { useState, useEffect, useCallback } from 'react';
import { isTauri } from '../App';

export interface UpdaterState {
  isChecking: boolean;
  updateAvailable: boolean;
  newVersion: string | null;
  currentVersion: string;
  isDownloading: boolean;
  downloadProgress: number; // 0 to 100
  statusMessage: string | null;
  error: string | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    isChecking: false,
    updateAvailable: false,
    newVersion: null,
    currentVersion: '1.1.5',
    isDownloading: false,
    downloadProgress: 0,
    statusMessage: null,
    error: null,
  });

  const checkForUpdates = useCallback(async (manual = false) => {
    if (!isTauri) {
      if (manual) {
        setState((prev) => ({
          ...prev,
          statusMessage: 'Updates are only available in the Windows desktop app.',
        }));
        setTimeout(() => setState((prev) => ({ ...prev, statusMessage: null })), 4000);
      }
      return;
    }

    setState((prev) => ({ ...prev, isChecking: true, error: null, statusMessage: null }));

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update && update.available) {
        setState((prev) => ({
          ...prev,
          isChecking: false,
          updateAvailable: true,
          newVersion: update.version,
          currentVersion: update.currentVersion || prev.currentVersion,
          statusMessage: `v${update.version} available!`,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isChecking: false,
          updateAvailable: false,
          statusMessage: manual ? 'BroTalk is up to date!' : null,
        }));
        if (manual) {
          setTimeout(() => setState((prev) => ({ ...prev, statusMessage: null })), 3500);
        }
      }
    } catch (err: any) {
      console.warn('Updater check error:', err);
      setState((prev) => ({
        ...prev,
        isChecking: false,
        error: manual ? 'Could not check for updates (offline or release pending).' : null,
      }));
      if (manual) {
        setTimeout(() => setState((prev) => ({ ...prev, error: null })), 4000);
      }
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!isTauri) return;

    setState((prev) => ({
      ...prev,
      isDownloading: true,
      downloadProgress: 0,
      statusMessage: 'Downloading update...',
      error: null,
    }));

    try {
      const { check } = await import('@tauri-apps/plugin-updater');

      const update = await check();
      if (!update || !update.available) {
        setState((prev) => ({ ...prev, isDownloading: false, updateAvailable: false }));
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      // 1. Gracefully stop audio engine to free WASAPI endpoints & MMCSS threads immediately
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('stop_engine');
      } catch (err) {
        console.warn('Could not stop audio engine prior to update:', err);
      }

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const pct = Math.round((downloaded / contentLength) * 100);
              setState((prev) => ({
                ...prev,
                downloadProgress: pct,
                statusMessage: `Downloading: ${pct}%`,
              }));
            }
            break;
          case 'Finished':
            setState((prev) => ({
              ...prev,
              downloadProgress: 100,
              statusMessage: 'Installing & restarting...',
            }));
            break;
        }
      });

      // On Windows, the NSIS installer is already launched with `/R` (auto-restart) and the
      // process exits. Calling relaunch() here spawns a duplicate process that causes NSIS
      // to fail with "Failed to kill BroTalk".
    } catch (err: any) {
      console.error('Update download/install failed:', err);
      setState((prev) => ({
        ...prev,
        isDownloading: false,
        error: `Update failed: ${err.message || String(err)}`,
      }));
    }
  }, []);

  // Check on app mount
  useEffect(() => {
    checkForUpdates(false);
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates: () => checkForUpdates(true),
    downloadAndInstall,
  };
}
