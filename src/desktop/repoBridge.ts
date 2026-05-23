import type { RepoInspection } from "../domain/types";

export const repoBridge = {
  isAvailable: () => Boolean(window.kanbanAgent?.repo),

  selectFolder: async (): Promise<{ ok: boolean; path: string | null; message: string }> => {
    if (!window.kanbanAgent?.repo) {
      return { ok: false, path: null, message: "Folder selection is only available in the Electron desktop app." };
    }

    return window.kanbanAgent.repo.selectFolder();
  },

  inspect: async (options: {
    allowedEditableFolders: string;
    blockedFilePatterns: string;
    repoPath: string;
  }): Promise<RepoInspection & { ok: boolean; message: string }> => {
    if (!window.kanbanAgent?.repo) {
      return {
        ok: false,
        message: "Repo inspection is only available in the Electron desktop app.",
        repoPath: options.repoPath,
        scannedAt: new Date().toISOString(),
        isGitRepo: false,
        currentBranch: "",
        dirty: false,
        changedFiles: [],
        fileTree: [],
        warnings: ["Repo inspection is only available in the Electron desktop app."]
      };
    }

    return window.kanbanAgent.repo.inspect(options);
  },

  readFile: async (options: {
    allowedEditableFolders: string;
    blockedFilePatterns: string;
    relativePath: string;
    repoPath: string;
  }): Promise<{ ok: boolean; content: string; message: string }> => {
    if (!window.kanbanAgent?.repo) {
      return {
        ok: false,
        content: "",
        message: "File reading is only available in the Electron desktop app."
      };
    }

    return window.kanbanAgent.repo.readFile(options);
  }
};
