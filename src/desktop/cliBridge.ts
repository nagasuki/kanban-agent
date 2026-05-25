export interface CliRunOptions {
  args: string;
  command: string;
  cwd: string;
  environmentVariables?: string;
  onOutput?: (event: CliOutputEvent) => void;
  prompt: string;
  resolvedExecutablePath?: string;
  runId?: string;
  timeoutSeconds: number;
}

export interface CliOutputEvent {
  runId: string;
  stream: "stdout" | "stderr";
  chunk: string;
  timestamp: string;
}

export interface CliRunResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled?: boolean;
  resolvedExecutablePath?: string;
  logs?: Array<{ stream: "system" | "stdout" | "stderr"; chunk: string; timestamp: string }>;
}

export interface CliValidationResult {
  ok: boolean;
  message: string;
  resolvedExecutablePath: string;
  version: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut?: boolean;
  logs?: CliRunResult["logs"];
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
        timedOut: false,
        logs: []
      };
    }

    const { onOutput, ...ipcOptions } = options;
    let unsubscribe: (() => void) | undefined;
    if (onOutput && options.runId && window.kanbanAgent.cli.onOutput) {
      unsubscribe = window.kanbanAgent.cli.onOutput((event) => {
        if (event.runId === options.runId) {
          onOutput(event);
        }
      });
    }

    try {
      return await window.kanbanAgent.cli.run(ipcOptions);
    } finally {
      unsubscribe?.();
    }
  },

  cancel: async (runId: string): Promise<{ ok: boolean; message: string }> => {
    if (!window.kanbanAgent?.cli?.cancel) {
      return { ok: false, message: "CLI cancellation is only available in the Electron desktop app." };
    }
    return window.kanbanAgent.cli.cancel({ runId });
  },

  test: async (options: Omit<CliRunOptions, "prompt" | "onOutput" | "runId">): Promise<CliValidationResult> => {
    if (!window.kanbanAgent?.cli?.test) {
      return {
        ok: false,
        message: "CLI validation is only available in the Electron desktop app.",
        resolvedExecutablePath: "",
        version: "",
        stdout: "",
        stderr: "CLI validation is only available in the Electron desktop app.",
        exitCode: null
      };
    }
    return window.kanbanAgent.cli.test(options);
  }
};
