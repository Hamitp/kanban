import type { AppData } from "./types";

export interface DesktopSaveInfo {
  isDesktop: true;
  saveDirectory: string;
  backupDirectory: string;
  dataFile: string;
  automaticBackups: true;
}

declare global {
  interface Window {
    akisDesktop?: {
      loadWorkspace: () => Promise<AppData | null>;
      saveWorkspace: (data: AppData) => Promise<DesktopSaveInfo & { savedAt: string }>;
      getSaveInfo: () => Promise<DesktopSaveInfo>;
      openSaveFolder: () => Promise<string>;
    };
  }
}

export {};
