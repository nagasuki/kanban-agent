import { createId, nowIso } from "./id";
import type { ActivityLogEntry, ProjectContext, ReviewChecklist, SafetySettings } from "./types";

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
