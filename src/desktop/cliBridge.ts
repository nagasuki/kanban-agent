export interface CliRunOptions {
  args: string;
  command: string;
  cwd: string;
  prompt: string;
  timeoutSeconds: number;
}

export interface CliRunResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export const cliBridge = {
  isAvailable: () => Boolean(window.kanbanAgent?.cli),

  run: async (options: CliRunOptions): Promise<CliRunResult> => {
    if (!window.kanbanAgent?.cli) {
      return {
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: "CLI runner is only available in the Electron desktop app.",
        timedOut: false
      };
    }

    return window.kanbanAgent.cli.run(options);
  }
};
