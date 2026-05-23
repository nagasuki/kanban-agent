export type BoardColumnId =
  | "my-skill"
  | "my-plan"
  | "skill-used"
  | "start-implement"
  | "in-process"
  | "in-review"
  | "successfully";

export type ExecutionMode =
  | "Plan Only"
  | "Suggest Patch"
  | "Apply Patch"
  | "Apply + Run Test"
  | "Apply + Commit"
  | "Apply + PR";

export type ModelProvider = "OpenAI" | "Anthropic" | "Google" | "Local" | "Custom API";

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
  extraPromptNotes: string;
  notes: string;
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
  defaultModelProfileId: string;
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

export interface KanbanCard {
  id: string;
  workspaceId: string;
  columnId: BoardColumnId;
  title: string;
  description: string;
  skillIds: string[];
  modelProfileId: string;
  agentProfileId?: string;
  executionMode: ExecutionMode;
  projectContext: ProjectContext;
  safetySettings: SafetySettings;
  reviewChecklist: ReviewChecklist;
  activityLog: ActivityLogEntry[];
  resultSummary: string;
  diffPlaceholder: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  repoPath: string;
  defaultBranch: string;
  defaultModelProfileId: string;
  defaultAgentProfileId: string;
  allowedEditableFolders: string;
  blockedFilePatterns: string;
  testCommand: string;
  buildCommand: string;
  cards: KanbanCard[];
  skills: SkillPreset[];
  modelProfiles: ModelProfile[];
  agentProfiles: AgentProfile[];
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  activeWorkspaceId: string;
  workspaces: Workspace[];
}
