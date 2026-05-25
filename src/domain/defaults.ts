import { createId, nowIso } from "./id";
import type {
  ActivityLogEntry,
  CliToolProfile,
  ProjectContext,
  ReviewChecklist,
  SafetySettings,
  ValidationRules
} from "./types";

export const createDefaultSafetySettings = (): SafetySettings => ({
  previewDiffBeforeApply: true,
  backupBeforeEdit: true,
  restrictEditableFolders: true,
  blockedSecretFiles: true,
  requireApprovalBeforeCommit: true,
  requireApprovalBeforePr: true
});

export const createDefaultReviewChecklist = (): ReviewChecklist => ({
  scopeMatchesPlan: false,
  buildTestPassed: false,
  codeStyleAcceptable: false,
  noRiskyFileChanged: false,
  summaryIsClear: false,
  userApproved: false
});

export const createDefaultValidationRules = (): ValidationRules => ({
  runBuild: false,
  runLint: false,
  runTests: false,
  checkFormatting: false
});

export const createDefaultProjectContext = (repoPath = ""): ProjectContext => ({
  repoPath,
  targetPaths: "",
  targetFiles: "",
  targetFolders: "",
  relatedDocuments: "",
  relatedIssueLink: "",
  attachedFileContext: "",
  extraPromptNotes: "",
  notes: ""
});

export const createLogEntry = (
  message: string,
  level: ActivityLogEntry["level"] = "info"
): ActivityLogEntry => ({
  id: createId("log"),
  message,
  level,
  timestamp: nowIso()
});

export const createDefaultCliToolProfiles = (): CliToolProfile[] => {
  const timestamp = nowIso();
  const isWindows = typeof window === "undefined" || window.kanbanAgent?.platform === "win32";
  const shellCommand = isWindows ? "cmd" : "sh";
  return [
    {
      id: createId("cli"),
      name: "Claude Code",
      provider: "Claude Code",
      providerId: "claude-code",
      displayName: "Claude Code",
      command: shellCommand,
      args: isWindows ? "/c claude -p" : "-c \"claude -p\"",
      timeoutSeconds: 600,
      environmentVariables: "",
      workingDirectory: "",
      resolvedExecutablePath: "",
      detectedVersion: "",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: createId("cli"),
      name: "Codex CLI",
      provider: "Codex",
      providerId: "codex-cli",
      displayName: "Codex CLI",
      command: shellCommand,
      args: isWindows ? "/c codex exec -" : "-c \"codex exec -\"",
      timeoutSeconds: 600,
      environmentVariables: "",
      workingDirectory: "",
      resolvedExecutablePath: "",
      detectedVersion: "",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
};
