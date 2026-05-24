export type BoardColumnId = "my-plan" | "start-implement" | "in-process" | "in-review" | "done";

export type ExecutionMode =
  | "Plan Only"
  | "Suggest Patch"
  | "Apply Patch"
  | "Apply + Run Test"
  | "Apply + Commit"
  | "Apply + PR";

export type ModelProvider = "OpenAI" | "Anthropic" | "Google" | "Local" | "Custom API";

export type CliToolProvider = "Claude Code" | "Codex" | "Custom CLI";

export type AgentRunnerType = "api" | "cli";

export type WorkspaceVersionControlProvider = "auto" | "git" | "plastic";

export type DetectedVersionControlProvider = "git" | "plastic" | "none";

export type TaskPriority = "Critical" | "High" | "Normal" | "Low";

export type SessionStatus = "running" | "completed" | "approved" | "rejected" | "cancelled" | "failed";

export type SessionRetryMode = "fresh" | "continue";

export interface BoardColumn {
  id: BoardColumnId;
  title: string;
  description: string;
}

export interface SafetySettings {
  previewDiffBeforeApply: boolean;
  backupBeforeEdit: boolean;
  restrictEditableFolders: boolean;
  blockedSecretFiles: boolean;
  requireApprovalBeforeCommit: boolean;
  requireApprovalBeforePr: boolean;
}

export interface ReviewChecklist {
  scopeMatchesPlan: boolean;
  buildTestPassed: boolean;
  codeStyleAcceptable: boolean;
  noRiskyFileChanged: boolean;
  summaryIsClear: boolean;
  userApproved: boolean;
}

export interface ValidationRules {
  runBuild: boolean;
  runLint: boolean;
  runTests: boolean;
  checkFormatting: boolean;
}

export interface ValidationResult {
  id: string;
  name: string;
  status: "pending" | "passed" | "failed" | "skipped";
  output: string;
  completedAt?: string;
}

export interface SessionContextSnapshot {
  title: string;
  description: string;
  skillIds: string[];
  executionMode: ExecutionMode;
  projectContext: ProjectContext;
  safetySettings: SafetySettings;
  validationRules: ValidationRules;
  priority: TaskPriority;
  dependencyCardIds: string[];
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface ImplementationSession {
  id: string;
  cardId: string;
  attemptNumber: number;
  status: SessionStatus;
  retryMode: SessionRetryMode;
  selectedAgentProfileId?: string;
  runnerType: AgentRunnerType;
  modelProfileId: string;
  cliToolProfileId?: string;
  contextSnapshot: SessionContextSnapshot;
  promptPreview: string;
  logs: ActivityLogEntry[];
  currentStep: string;
  changedFiles: string[];
  diffText: string;
  summary: string;
  validationResults: ValidationResult[];
  tokenUsage: TokenUsage;
  durationSeconds: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogEntry {
  id: string;
  message: string;
  timestamp: string;
  level: "info" | "warning" | "success";
}

export interface ProjectContext {
  repoPath: string;
  targetPaths: string;
  targetFiles: string;
  targetFolders: string;
  relatedDocuments: string;
  relatedIssueLink: string;
  attachedFileContext: string;
  extraPromptNotes: string;
  notes: string;
}

export interface FileTreeNode {
  path: string;
  name: string;
  type: "file" | "directory";
  blocked: boolean;
  children?: FileTreeNode[];
}

export interface RepoInspection {
  repoPath: string;
  scannedAt: string;
  versionControlProvider: DetectedVersionControlProvider;
  requestedVersionControlProvider: WorkspaceVersionControlProvider;
  isGitRepo: boolean;
  isPlasticWorkspace: boolean;
  currentBranch: string;
  branches: string[];
  dirty: boolean;
  changedFiles: string[];
  fileTree: FileTreeNode[];
  warnings: string[];
}

export interface SkillPreset {
  id: string;
  name: string;
  version: string;
  description: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  skillIds: string[];
  defaultRunnerType: AgentRunnerType;
  defaultModelProfileId: string;
  defaultCliToolProfileId: string;
  defaultExecutionMode: ExecutionMode;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: ModelProvider;
  modelName: string;
  apiKeyPlaceholder: string;
  baseUrlPlaceholder: string;
  temperature: number;
  maxTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface CliToolProfile {
  id: string;
  name: string;
  provider: CliToolProvider;
  command: string;
  args: string;
  timeoutSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanCard {
  id: string;
  workspaceId: string;
  columnId: BoardColumnId;
  title: string;
  description: string;
  skillIds: string[];
  runnerType: AgentRunnerType;
  modelProfileId: string;
  agentProfileId?: string;
  cliToolProfileId?: string;
  executionMode: ExecutionMode;
  priority: TaskPriority;
  dependencyCardIds: string[];
  validationRules: ValidationRules;
  sessions: ImplementationSession[];
  activeSessionId?: string;
  rejectCount: number;
  projectContext: ProjectContext;
  safetySettings: SafetySettings;
  reviewChecklist: ReviewChecklist;
  activityLog: ActivityLogEntry[];
  resultSummary: string;
  diffPlaceholder: string;
  patchText: string;
  testOutput: string;
  buildOutput: string;
  applyOutput: string;
  commitMessage: string;
  prTitle: string;
  prDescription: string;
  prUrl: string;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  repoPath: string;
  versionControlProvider: WorkspaceVersionControlProvider;
  defaultBranch: string;
  defaultModelProfileId: string;
  defaultAgentProfileId: string;
  defaultCliToolProfileId: string;
  allowedEditableFolders: string;
  blockedFilePatterns: string;
  testCommand: string;
  buildCommand: string;
  repoInspection?: RepoInspection;
  cards: KanbanCard[];
  skills: SkillPreset[];
  modelProfiles: ModelProfile[];
  cliToolProfiles: CliToolProfile[];
  agentProfiles: AgentProfile[];
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  activeWorkspaceId: string;
  workspaces: Workspace[];
}
