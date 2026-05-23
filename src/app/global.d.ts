export {};

declare global {
  interface Window {
    kanbanAgent?: {
      platform: string;
      secureKeys?: {
        set: (key: string, value: string) => Promise<{ ok: boolean; message: string }>;
        get: (key: string) => Promise<{ ok: boolean; value: string | null; message: string }>;
        delete: (key: string) => Promise<{ ok: boolean; message: string }>;
        has: (key: string) => Promise<{ ok: boolean; hasKey: boolean; encryptionAvailable: boolean }>;
      };
      repo?: {
        selectFolder: () => Promise<{ ok: boolean; path: string | null; message: string }>;
        inspect: (
          options: {
            allowedEditableFolders: string;
            blockedFilePatterns: string;
            repoPath: string;
          }
        ) => Promise<import("../domain/types").RepoInspection & { ok: boolean; message: string }>;
        readFile: (
          options: {
            allowedEditableFolders: string;
            blockedFilePatterns: string;
            relativePath: string;
            repoPath: string;
          }
        ) => Promise<{ ok: boolean; content: string; message: string }>;
        applyPatch: (
          options: {
            allowedEditableFolders: string;
            blockedFilePatterns: string;
            patchText: string;
            repoPath: string;
          }
        ) => Promise<{ ok: boolean; output: string; backupPath: string }>;
        runCommand: (options: { command: string; repoPath: string }) => Promise<{ ok: boolean; output: string }>;
        gitCommit: (options: { message: string; repoPath: string }) => Promise<{ ok: boolean; output: string }>;
        gitCheckoutFiles: (options: { files: string; repoPath: string }) => Promise<{ ok: boolean; output: string }>;
        githubPr: (
          options: { body: string; repoPath: string; title: string }
        ) => Promise<{ ok: boolean; url: string; output: string }>;
      };
      cli?: {
        run: (
          options: {
            args: string;
            command: string;
            cwd: string;
            prompt: string;
            timeoutSeconds: number;
          }
        ) => Promise<{
          ok: boolean;
          exitCode: number | null;
          stdout: string;
          stderr: string;
          timedOut: boolean;
        }>;
      };
    };
  }
}
