import { createSeedState } from "../data/seed";
import {
  createDefaultCliToolProfiles,
  createDefaultProjectContext,
  createDefaultSafetySettings,
  createDefaultValidationRules
} from "../domain/defaults";
import { createId, nowIso } from "../domain/id";
import type { AppState, BoardColumnId, CliToolProfile, ImplementationSession, KanbanCard } from "../domain/types";

const STORAGE_KEY = "kanban-agent.state.v1";

export const loadAppState = (): AppState => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createSeedState();
  }

  try {
    return normalizeAppState(JSON.parse(raw) as AppState);
  } catch {
    return createSeedState();
  }
};

export const saveAppState = (state: AppState): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const resetAppState = (): AppState => {
  const seed = createSeedState();
  saveAppState(seed);
  return seed;
};

const normalizeAppState = (state: AppState): AppState => ({
  ...state,
  workspaces: state.workspaces.map((workspace) => {
    const cliToolProfiles =
      workspace.cliToolProfiles && workspace.cliToolProfiles.length > 0
        ? workspace.cliToolProfiles
        : createDefaultCliToolProfiles();

    return {
      ...workspace,
      repoPath: workspace.repoPath ?? "",
      versionControlProvider: workspace.versionControlProvider ?? "auto",
      defaultBranch: workspace.defaultBranch ?? "main",
      defaultModelProfileId: workspace.defaultModelProfileId ?? workspace.modelProfiles[0]?.id ?? "",
      defaultCliToolProfileId: workspace.defaultCliToolProfileId || cliToolProfiles[0]?.id || "",
      allowedEditableFolders: workspace.allowedEditableFolders ?? "",
      blockedFilePatterns: workspace.blockedFilePatterns ?? ".env, *.pem, *.key",
      testCommand: workspace.testCommand ?? "",
      buildCommand: workspace.buildCommand ?? "",
      repoInspection: workspace.repoInspection
        ? {
            ...workspace.repoInspection,
            versionControlProvider: workspace.repoInspection.versionControlProvider ?? (workspace.repoInspection.isGitRepo ? "git" : "none"),
            requestedVersionControlProvider: workspace.repoInspection.requestedVersionControlProvider ?? workspace.versionControlProvider ?? "auto",
            isPlasticWorkspace: workspace.repoInspection.isPlasticWorkspace ?? false,
            branches: workspace.repoInspection.branches ?? []
          }
        : undefined,
      skills: workspace.skills.map((skill) => ({
        ...skill,
        version: skill.version ?? "0.1.0"
      })),
      cliToolProfiles: cliToolProfiles.map(normalizeCliToolProfile),
      agentProfiles: workspace.agentProfiles.map((agent) => ({
        ...agent,
        defaultRunnerType:
          agent.defaultRunnerType ?? (agent.defaultCliToolProfileId || workspace.defaultCliToolProfileId ? "cli" : "api"),
        defaultModelProfileId: agent.defaultModelProfileId ?? workspace.defaultModelProfileId ?? workspace.modelProfiles[0]?.id ?? "",
        defaultCliToolProfileId: agent.defaultCliToolProfileId ?? workspace.defaultCliToolProfileId ?? cliToolProfiles[0]?.id ?? "",
        defaultExecutionMode: agent.defaultExecutionMode ?? "Suggest Patch"
      })),
      cards: workspace.cards.map((card) => normalizeCard(card, workspace, cliToolProfiles))
    };
  })
});

const normalizeCard = (card: KanbanCard, workspace: AppState["workspaces"][number], cliToolProfiles: CliToolProfile[]): KanbanCard => {
  const normalizedColumnId = normalizeColumnId(card.columnId);
  const validationRules = {
    ...createDefaultValidationRules(),
    ...card.validationRules
  };
  const normalizedCard = {
    ...card,
    columnId: normalizedColumnId,
    runnerType: card.runnerType ?? (card.cliToolProfileId ? "cli" : "api"),
    modelProfileId: card.modelProfileId ?? workspace.defaultModelProfileId ?? workspace.modelProfiles[0]?.id ?? "",
    cliToolProfileId: card.cliToolProfileId ?? workspace.defaultCliToolProfileId ?? cliToolProfiles[0]?.id,
    priority: card.priority ?? "Normal",
    dependencyCardIds: card.dependencyCardIds ?? [],
    validationRules,
    sessions: card.sessions ?? [],
    activeSessionId: card.activeSessionId,
    rejectCount: card.rejectCount ?? 0,
    patchText: card.patchText ?? "",
    testOutput: card.testOutput ?? "",
    buildOutput: card.buildOutput ?? "",
    applyOutput: card.applyOutput ?? "",
    commitMessage: card.commitMessage ?? "",
    prTitle: card.prTitle ?? "",
    prDescription: card.prDescription ?? "",
    prUrl: card.prUrl ?? "",
    locked: card.locked ?? false,
    safetySettings: {
      ...createDefaultSafetySettings(),
      ...card.safetySettings,
      requireApprovalBeforePr: card.safetySettings?.requireApprovalBeforePr ?? true
    },
    projectContext: {
      ...createDefaultProjectContext(workspace.repoPath),
      ...card.projectContext
    }
  };

  const sessions =
    normalizedCard.sessions.length > 0
      ? normalizedCard.sessions.map((session) => normalizeSession(session, normalizedCard))
      : createLegacySessions(normalizedCard);

  return {
    ...normalizedCard,
    sessions,
    activeSessionId:
      normalizedCard.activeSessionId ??
      (normalizedCard.columnId === "in-process" || normalizedCard.columnId === "in-review" ? sessions.at(-1)?.id : undefined)
  };
};

const normalizeColumnId = (columnId: string): BoardColumnId => {
  if (columnId === "my-skill" || columnId === "skill-used") {
    return "my-plan";
  }
  if (columnId === "successfully") {
    return "done";
  }
  if (columnId === "my-plan" || columnId === "start-implement" || columnId === "in-process" || columnId === "in-review" || columnId === "done") {
    return columnId;
  }
  return "my-plan";
};

const normalizeSession = (session: ImplementationSession, card: KanbanCard): ImplementationSession => ({
  ...session,
  retryMode: session.retryMode ?? "fresh",
  runnerType: session.runnerType ?? card.runnerType,
  modelProfileId: session.modelProfileId ?? card.modelProfileId,
  cliToolProfileId: session.cliToolProfileId ?? card.cliToolProfileId,
  contextSnapshot: {
    title: session.contextSnapshot?.title ?? card.title,
    description: session.contextSnapshot?.description ?? card.description,
    skillIds: session.contextSnapshot?.skillIds ?? card.skillIds,
    executionMode: session.contextSnapshot?.executionMode ?? card.executionMode,
    projectContext: session.contextSnapshot?.projectContext ?? card.projectContext,
    safetySettings: session.contextSnapshot?.safetySettings ?? card.safetySettings,
    validationRules: session.contextSnapshot?.validationRules ?? card.validationRules,
    priority: session.contextSnapshot?.priority ?? card.priority,
    dependencyCardIds: session.contextSnapshot?.dependencyCardIds ?? card.dependencyCardIds
  },
  logs: session.logs ?? [],
  changedFiles: session.changedFiles ?? [],
  validationResults: session.validationResults ?? [],
  tokenUsage: session.tokenUsage ?? {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0
  },
  durationSeconds: session.durationSeconds ?? 0
});

const createLegacySessions = (card: KanbanCard): ImplementationSession[] => {
  if (card.columnId !== "in-process" && card.columnId !== "in-review" && card.columnId !== "done") {
    return [];
  }

  const timestamp = nowIso();
  const status =
    card.columnId === "in-process" ? "running" : card.columnId === "done" ? "approved" : "completed";
  return [
    {
      id: createId("session"),
      cardId: card.id,
      attemptNumber: 1,
      status,
      retryMode: "fresh",
      selectedAgentProfileId: card.agentProfileId,
      runnerType: card.runnerType,
      modelProfileId: card.modelProfileId,
      cliToolProfileId: card.cliToolProfileId,
      contextSnapshot: {
        title: card.title,
        description: card.description,
        skillIds: card.skillIds,
        executionMode: card.executionMode,
        projectContext: card.projectContext,
        safetySettings: card.safetySettings,
        validationRules: card.validationRules,
        priority: card.priority,
        dependencyCardIds: card.dependencyCardIds
      },
      promptPreview: "Migrated legacy session.",
      logs: card.activityLog,
      currentStep: card.columnId === "in-process" ? "Running" : "Waiting for review",
      changedFiles: [],
      diffText: card.patchText || card.diffPlaceholder,
      summary: card.resultSummary,
      validationResults: [],
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0
      },
      durationSeconds: 0,
      startedAt: card.createdAt || timestamp,
      completedAt: card.columnId === "in-process" ? undefined : card.updatedAt || timestamp,
      createdAt: card.createdAt || timestamp,
      updatedAt: card.updatedAt || timestamp
    }
  ];
};

const normalizeCliToolProfile = (profile: CliToolProfile): CliToolProfile => {
  if (profile.provider === "Claude Code" && profile.command === "claude" && window.kanbanAgent?.platform === "win32") {
    return {
      ...profile,
      command: "claude.ps1",
      args: profile.args.trim() || "-p"
    };
  }

  if (profile.provider === "Claude Code" && profile.command === "claude" && !profile.args.trim()) {
    return {
      ...profile,
      args: "-p"
    };
  }

  if (profile.provider === "Codex" && profile.command === "codex" && !profile.args.trim()) {
    return {
      ...profile,
      args: "exec -"
    };
  }

  return profile;
};
