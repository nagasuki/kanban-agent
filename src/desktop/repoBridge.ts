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
  },

  applyPatch: async (options: {
    allowedEditableFolders: string;
    blockedFilePatterns: string;
    patchText: string;
    repoPath: string;
  }): Promise<{ ok: boolean; output: string; backupPath: string }> => {
    if (!window.kanbanAgent?.repo) {
      return { ok: false, output: "Patch apply is only available in the Electron desktop app.", backupPath: "" };
    }

    return window.kanbanAgent.repo.applyPatch(options);
  },

  runCommand: async (options: { command: string; repoPath: string }): Promise<{ ok: boolean; output: string }> => {
    if (!window.kanbanAgent?.repo) {
      return { ok: false, output: "Command runner is only available in the Electron desktop app." };
    }

    return window.kanbanAgent.repo.runCommand(options);
  },

  gitCommit: async (options: { message: string; repoPath: string }): Promise<{ ok: boolean; output: string }> => {
    if (!window.kanbanAgent?.repo) {
      return { ok: false, output: "Git commit is only available in the Electron desktop app." };
    }

    return window.kanbanAgent.repo.gitCommit(options);
  },

  gitCheckoutFiles: async (options: { files: string; repoPath: string }): Promise<{ ok: boolean; output: string }> => {
    if (!window.kanbanAgent?.repo) {
      return { ok: false, output: "Git rollback is only available in the Electron desktop app." };
    }

    return window.kanbanAgent.repo.gitCheckoutFiles(options);
  },

  githubPr: async (
    options: { body: string; repoPath: string; title: string }
  ): Promise<{ ok: boolean; url: string; output: string }> => {
    if (!window.kanbanAgent?.repo) {
      return { ok: false, url: "", output: "GitHub PR creation is only available in the Electron desktop app." };
    }

    return window.kanbanAgent.repo.githubPr(options);
  }
};
