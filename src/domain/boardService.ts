import {
  createDefaultProjectContext,
  createDefaultReviewChecklist,
  createDefaultSafetySettings,
  createDefaultValidationRules,
  createLogEntry
} from "./defaults";
import { resolveImplementAgent, resolvePlanAgent, supportsImplementMode, supportsPlanMode } from "./agentCapabilities";
import { buildExecutionPreview, createImplementationLogBurst } from "./executionService";
import { createId, nowIso } from "./id";
import type {
  BoardColumnId,
  ImplementationSession,
  KanbanCard,
  ProviderUsageRecord,
  SessionRetryMode,
  ValidationResult,
  Workspace
} from "./types";

export interface MoveCardResult {
  workspace: Workspace;
  warning?: string;
}

export interface CreatePlanCardResult {
  workspace: Workspace;
  cardId?: string;
  warning?: string;
}

export interface CreatePlanCardOptions {
  agentProfileId?: string;
  runnerType?: KanbanCard["runnerType"];
  modelProfileId?: string;
  cliToolProfileId?: string;
}

export const createCard = (workspace: Workspace, columnId: BoardColumnId): Workspace => {
  if (!canUserCreateCard(columnId)) {
    return workspace;
  }

  const timestamp = nowIso();
  const defaultAgent = columnId === "my-plan" ? resolvePlanAgent(workspace) : resolveImplementAgent(workspace);
  const card: KanbanCard = {
    id: createId("card"),
    workspaceId: workspace.id,
    columnId,
    title: "Untitled agent task",
    description: "Write the implementation plan here.",
    skillIds: defaultAgent?.skillIds ?? [],
    runnerType: defaultAgent?.defaultRunnerType ?? (workspace.defaultCliToolProfileId ? "cli" : "api"),
    modelProfileId: defaultAgent?.defaultModelProfileId ?? workspace.defaultModelProfileId,
    agentProfileId: defaultAgent?.id,
    planAgentProfileId: columnId === "my-plan" ? defaultAgent?.id : undefined,
    implementAgentProfileId: columnId === "start-implement" ? defaultAgent?.id : undefined,
    cliToolProfileId: defaultAgent?.defaultCliToolProfileId || workspace.defaultCliToolProfileId || undefined,
    executionMode: defaultAgent?.defaultExecutionMode ?? "Suggest Patch",
    priority: "Normal",
    dependencyCardIds: [],
    validationRules: createDefaultValidationRules(),
    sessions: [],
    activeSessionId: undefined,
    rejectCount: 0,
    projectContext: createDefaultProjectContext(workspace.repoPath),
    safetySettings: createDefaultSafetySettings(),
    reviewChecklist: createDefaultReviewChecklist(),
    activityLog: [createLogEntry("Card created")],
    resultSummary: "",
    diffPlaceholder: "",
    patchText: "",
    testOutput: "",
    buildOutput: "",
    applyOutput: "",
    commitMessage: "",
    prTitle: "",
    prDescription: "",
    prUrl: "",
    locked: false,
    planCompletedAt: columnId === "start-implement" ? timestamp : undefined,
    implementationStartedAt: undefined,
    implementationCompletedAt: undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...workspace,
    cards: [card, ...workspace.cards],
    updatedAt: timestamp
  };
};

export const createPlanCardFromPrompt = (
  workspace: Workspace,
  prompt: string,
  options: CreatePlanCardOptions = {}
): CreatePlanCardResult => {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    return { workspace, warning: "Prompt is required before creating a plan." };
  }

  const timestamp = nowIso();
  const defaultAgent = resolvePlanAgent(workspace, options.agentProfileId);
  if (!defaultAgent) {
    return { workspace, warning: "No Plan Agent is configured." };
  }
  if (!supportsPlanMode(defaultAgent)) {
    return { workspace, warning: "Selected agent cannot run Plan Mode." };
  }
  const title = titleFromPrompt(cleanPrompt);
  const card: KanbanCard = {
    id: createId("card"),
    workspaceId: workspace.id,
    columnId: "my-plan",
    title,
    description: "Generating plan from prompt...",
    skillIds: defaultAgent?.skillIds ?? [],
    runnerType: options.runnerType ?? defaultAgent?.defaultRunnerType ?? (workspace.defaultCliToolProfileId ? "cli" : "api"),
    modelProfileId: options.modelProfileId ?? defaultAgent?.defaultModelProfileId ?? workspace.defaultModelProfileId,
    agentProfileId: options.agentProfileId ?? defaultAgent?.id,
    planAgentProfileId: options.agentProfileId ?? defaultAgent?.id,
    implementAgentProfileId: resolveImplementAgent(workspace, workspace.defaultImplementAgentProfileId)?.id,
    cliToolProfileId:
      options.cliToolProfileId ?? (defaultAgent?.defaultCliToolProfileId || workspace.defaultCliToolProfileId || undefined),
    executionMode: "Plan Only",
    priority: "Normal",
    dependencyCardIds: [],
    validationRules: createDefaultValidationRules(),
    sessions: [],
    activeSessionId: undefined,
    rejectCount: 0,
    projectContext: {
      ...createDefaultProjectContext(workspace.repoPath),
      extraPromptNotes: cleanPrompt
    },
    safetySettings: createDefaultSafetySettings(),
    reviewChecklist: createDefaultReviewChecklist(),
    activityLog: [createLogEntry("Plan prompt submitted"), createLogEntry("AI Plan Mode started")],
    resultSummary: "",
    diffPlaceholder: "",
    patchText: "",
    testOutput: "",
    buildOutput: "",
    applyOutput: "",
    commitMessage: "",
    prTitle: "",
    prDescription: "",
    prUrl: "",
    locked: true,
    planCompletedAt: undefined,
    implementationStartedAt: undefined,
    implementationCompletedAt: undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    workspace: {
      ...workspace,
      cards: [card, ...workspace.cards],
      updatedAt: timestamp
    },
    cardId: card.id
  };
};

export const completePlanDraft = (
  workspace: Workspace,
  cardId: string,
  result: { ok: boolean; provider: string; summary: string; rawText: string }
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            description: result.rawText || result.summary,
            locked: false,
            planCompletedAt: result.ok ? timestamp : card.planCompletedAt,
            activityLog: [
              ...card.activityLog,
              createLogEntry(
                result.ok ? `Plan generated by ${result.provider}` : `Plan generation failed in ${result.provider}`,
                result.ok ? "success" : "warning"
              )
            ],
            updatedAt: timestamp
          }
        : card
    ),
    updatedAt: timestamp
  };
};

export const updateCard = (
  workspace: Workspace,
  cardId: string,
  updates: Partial<Omit<KanbanCard, "id" | "workspaceId" | "createdAt">>
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            ...updates,
            updatedAt: timestamp
          }
        : card
    ),
    updatedAt: timestamp
  };
};

export const deleteCard = (workspace: Workspace, cardId: string): Workspace => ({
  ...workspace,
  cards: workspace.cards.filter((card) => card.id !== cardId),
  updatedAt: nowIso()
});

export const duplicateCard = (workspace: Workspace, cardId: string): Workspace => {
  const source = workspace.cards.find((card) => card.id === cardId);
  if (!source) {
    return workspace;
  }

  const timestamp = nowIso();
  const copy: KanbanCard = {
    ...source,
    id: createId("card"),
    title: `${source.title} copy`,
    activityLog: [...source.activityLog, createLogEntry("Card duplicated")],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...workspace,
    cards: [copy, ...workspace.cards],
    updatedAt: timestamp
  };
};

export const moveCard = (workspace: Workspace, cardId: string, targetColumnId: BoardColumnId): MoveCardResult => {
  const card = workspace.cards.find((item) => item.id === cardId);
  if (!card || card.columnId === targetColumnId) {
    return { workspace };
  }

  if (!canUserMoveCard(card.columnId, targetColumnId)) {
    return {
      workspace: appendCardLog(workspace, cardId, `Manual move to ${targetColumnId} is blocked`, "warning"),
      warning: "Only My Plan and Start Implement can be moved manually. In Process, In Review, and Done are system-controlled."
    };
  }

  const prepared = prepareCardForColumn(workspace, card, targetColumnId);
  if (prepared.warning) {
    return {
      workspace: appendCardLog(workspace, cardId, prepared.warning, "warning"),
      warning: prepared.warning
    };
  }

  const timestamp = nowIso();
  const movedCards = workspace.cards.map((item) => {
    if (item.id !== cardId) {
      return item;
    }

    const logs = [...item.activityLog, ...logsForMove(item, targetColumnId, workspace)];
    return {
      ...item,
      ...prepared.updates,
      columnId: targetColumnId,
      activityLog: logs,
      updatedAt: timestamp
    };
  });

  return {
    workspace: {
      ...workspace,
      cards: movedCards,
      updatedAt: timestamp
    }
  };
};

export const canUserCreateCard = (columnId: BoardColumnId): boolean =>
  columnId === "my-plan" || columnId === "start-implement";

export const canUserMoveCard = (sourceColumnId: BoardColumnId, targetColumnId: BoardColumnId): boolean =>
  (sourceColumnId === "my-plan" || sourceColumnId === "start-implement") &&
  (targetColumnId === "my-plan" || targetColumnId === "start-implement");

export const reorderCard = (
  workspace: Workspace,
  cardId: string,
  targetColumnId: BoardColumnId,
  targetIndex: number
): MoveCardResult => {
  const card = workspace.cards.find((item) => item.id === cardId);
  if (!card) {
    return { workspace };
  }

  if (!canUserMoveCard(card.columnId, targetColumnId)) {
    return {
      workspace: appendCardLog(workspace, cardId, `Manual move to ${targetColumnId} is blocked`, "warning"),
      warning: "Only My Plan and Start Implement can be reordered manually. In Process, In Review, and Done are system-controlled."
    };
  }

  const prepared = prepareCardForColumn(workspace, card, targetColumnId);
  if (prepared.warning) {
    return {
      workspace: appendCardLog(workspace, cardId, prepared.warning, "warning"),
      warning: prepared.warning
    };
  }

  const timestamp = nowIso();
  const otherCards = workspace.cards.filter((item) => item.id !== cardId);
  const beforeTarget = otherCards.filter((item) => item.columnId !== targetColumnId);
  const targetCards = otherCards.filter((item) => item.columnId === targetColumnId);
  const nextIndex = Math.max(0, Math.min(targetIndex, targetCards.length));
  const movedCard: KanbanCard = {
    ...card,
    ...prepared.updates,
    columnId: targetColumnId,
    activityLog:
      card.columnId === targetColumnId
        ? [...card.activityLog, createLogEntry("Card reordered")]
        : [...card.activityLog, ...logsForMove(card, targetColumnId, workspace)],
    updatedAt: timestamp
  };

  targetCards.splice(nextIndex, 0, movedCard);

  return {
    workspace: {
      ...workspace,
      cards: [...beforeTarget, ...targetCards],
      updatedAt: timestamp
    }
  };
};

const titleFromPrompt = (prompt: string): string => {
  const firstLine = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return "Untitled plan";
  }

  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
};

export const appendCardLog = (
  workspace: Workspace,
  cardId: string,
  message: string,
  level: "info" | "warning" | "success" = "info"
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            sessions: card.sessions.map((session) =>
              session.id === card.activeSessionId
                ? {
                    ...session,
                    currentStep: message,
                    logs: [...session.logs, createLogEntry(message, level)],
                    updatedAt: timestamp
                  }
                : session
            ),
            activityLog: [...card.activityLog, createLogEntry(message, level)],
            updatedAt: timestamp
          }
        : card
    ),
    updatedAt: timestamp
  };
};

export const updateActiveSessionUsage = (
  workspace: Workspace,
  cardId: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    wasEstimated: boolean;
  }
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            sessions: card.sessions.map((session) =>
              session.id === card.activeSessionId
                ? {
                    ...session,
                    tokenUsage: {
                      promptTokens: usage.inputTokens,
                      completionTokens: usage.outputTokens,
                      totalTokens: usage.totalTokens,
                      costUsd: usage.estimatedCostUsd
                    },
                    usageWasEstimated: usage.wasEstimated,
                    durationSeconds: Math.max(
                      0,
                      Math.round((new Date(timestamp).getTime() - new Date(session.startedAt).getTime()) / 1000)
                    ),
                    updatedAt: timestamp
                  }
                : session
            ),
            updatedAt: timestamp
          }
        : card
    ),
    updatedAt: timestamp
  };
};

export const applyReviewAction = (
  workspace: Workspace,
  cardId: string,
  action: "approve" | "request-changes" | "retry" | "rollback"
): Workspace => {
  const messages = {
    approve: "Review approved",
    "request-changes": "Session rejected",
    retry: "Retry requested",
    rollback: "Rollback requested"
  };

  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) => {
      if (card.id !== cardId) {
        return card;
      }
      const targetColumnId =
        action === "approve" ? "done" : action === "request-changes" ? "my-plan" : action === "retry" ? "start-implement" : card.columnId;
      const prepared = prepareCardForColumn(workspace, card, targetColumnId);

      return {
        ...card,
        ...prepared.updates,
        columnId: targetColumnId,
        activeSessionId: action === "approve" || action === "request-changes" ? undefined : card.activeSessionId,
        rejectCount: action === "request-changes" ? card.rejectCount + 1 : card.rejectCount,
        implementationCompletedAt: action === "approve" ? card.implementationCompletedAt || timestamp : card.implementationCompletedAt,
        sessions: updateLatestReviewableSession(card, action),
        reviewChecklist:
          action === "approve"
            ? {
                ...card.reviewChecklist,
                userApproved: true,
                summaryIsClear: true
              }
            : action === "request-changes"
              ? {
                  ...card.reviewChecklist,
                  userApproved: false
                }
              : card.reviewChecklist,
        activityLog: [...card.activityLog, createLogEntry(messages[action], action === "approve" ? "success" : "info")],
        updatedAt: timestamp
      };
    }),
    updatedAt: timestamp
  };
};

export const simulateExecution = (workspace: Workspace, cardId: string): MoveCardResult => {
  const timestamp = nowIso();
  const card = workspace.cards.find((item) => item.id === cardId);
  if (!card) {
    return { workspace };
  }

  if (card.columnId !== "in-process") {
    const started = startImplementationSession(workspace, cardId, "fresh", [
      createLogEntry("Fake runner started"),
      createLogEntry("Implementation started"),
      ...createImplementationLogBurst()
    ]);
    return started.warning ? started : { workspace: started.workspace };
  }

  return {
    workspace: {
      ...workspace,
      cards: workspace.cards.map((item) => {
      const card = item;
      if (card.id !== cardId) {
        return card;
      }

      const summary =
        card.resultSummary ||
        "Fake runner completed. The task is ready for human review before any real file operations exist.";
      const diffText =
        card.diffPlaceholder ||
        "Diff placeholder: fake runner generated no real patch. Future Suggest Patch mode will populate this.";
      return {
        ...card,
        columnId: "in-review",
        locked: false,
        resultSummary: summary,
        diffPlaceholder: diffText,
        sessions: completeActiveSession(card, {
          status: "completed",
          summary,
          diffText,
          currentStep: "Waiting for review",
          completedAt: timestamp,
          extraLogs: [
            createLogEntry("Fake runner generated result summary"),
            createLogEntry("Implementation completed and ready for review", "success")
          ]
        }),
        reviewChecklist: {
          ...card.reviewChecklist,
          scopeMatchesPlan: true,
          summaryIsClear: true
        },
        activityLog: [...card.activityLog, createLogEntry("Implementation completed and ready for review", "success")],
        updatedAt: timestamp
      };
    }),
    updatedAt: timestamp
    }
  };
};

export const cancelExecution = (workspace: Workspace, cardId: string): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            columnId: "start-implement",
            locked: false,
            sessions: completeActiveSession(card, {
              status: "cancelled",
              summary: "Execution cancelled by user.",
              diffText: card.diffPlaceholder,
              currentStep: "Cancelled",
              completedAt: timestamp,
              extraLogs: [createLogEntry("Execution cancelled", "warning")]
            }),
            activityLog: [...card.activityLog, createLogEntry("Execution cancelled", "warning")],
            updatedAt: timestamp
          }
        : card
    ),
    updatedAt: timestamp
  };
};

export const startPlanOnlyExecution = (
  workspace: Workspace,
  cardId: string,
  retryMode: SessionRetryMode = "fresh"
): MoveCardResult =>
  startImplementationSession(workspace, cardId, retryMode, [
    createLogEntry("API model execution started"),
    createLogEntry("Building prompt from plan, skills, and project context")
  ]);

export const completePlanOnlyExecution = (
  workspace: Workspace,
  cardId: string,
  result: { summary: string; rawText: string; provider: string; usageRecord?: ProviderUsageRecord }
): Workspace => {
  const timestamp = nowIso();
  const usage = result.usageRecord;
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            columnId: "in-review",
            locked: false,
            implementationCompletedAt: timestamp,
            resultSummary: result.summary,
            diffPlaceholder: result.rawText,
            patchText: card.executionMode === "Suggest Patch" ? result.rawText : card.patchText,
            sessions: completeActiveSession(card, {
              status: "completed",
              summary: result.summary,
              diffText: result.rawText,
              currentStep: "Waiting for review",
              completedAt: timestamp,
              tokenUsage: usage
                ? {
                    promptTokens: usage.inputTokens,
                    completionTokens: usage.outputTokens,
                    totalTokens: usage.totalTokens,
                    costUsd: usage.estimatedCostUsd ?? 0
                  }
                : undefined,
              usageWasEstimated: usage?.wasEstimated,
              providerId: usage?.providerId,
              providerName: usage?.providerName,
              modelName: usage?.modelName,
              usageRecordId: usage?.id,
              extraLogs: [
                createLogEntry(`Plan Only response received from ${result.provider}`, "success"),
                createLogEntry("Implementation completed and ready for review", "success")
              ]
            }),
            reviewChecklist: {
              ...card.reviewChecklist,
              scopeMatchesPlan: true,
              summaryIsClear: true
            },
            activityLog: [
              ...card.activityLog,
              createLogEntry(`Plan Only response received from ${result.provider}`, "success"),
              createLogEntry("Implementation completed and ready for review", "success")
            ],
            updatedAt: timestamp
          }
        : card
    ),
    providerUsageRecords: usage ? [...workspace.providerUsageRecords, usage] : workspace.providerUsageRecords,
    updatedAt: timestamp
  };
};

export const startCliExecution = (
  workspace: Workspace,
  cardId: string,
  retryMode: SessionRetryMode = "fresh"
): MoveCardResult => startImplementationSession(workspace, cardId, retryMode, [createLogEntry("CLI agent execution started")]);

export const completeCliExecution = (
  workspace: Workspace,
  cardId: string,
  result: {
    ok: boolean;
    provider: string;
    summary: string;
    rawText: string;
    executionLogs?: string[];
    resolvedExecutablePath?: string;
    usageRecord?: ProviderUsageRecord;
  }
): Workspace => {
  const timestamp = nowIso();
  const usage = result.usageRecord;
  const executionLogs = (result.executionLogs ?? [])
    .filter(Boolean)
    .slice(-30)
    .map((message) => createLogEntry(message));
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            columnId: "in-review",
            locked: false,
            implementationCompletedAt: timestamp,
            resultSummary: result.summary,
            diffPlaceholder: result.rawText,
            patchText: card.executionMode === "Suggest Patch" ? result.rawText : card.patchText,
            sessions: completeActiveSession(card, {
              status: result.ok ? "completed" : "failed",
              summary: result.summary,
              diffText: result.rawText,
              currentStep: "Waiting for review",
              completedAt: timestamp,
              tokenUsage: usage
                ? {
                    promptTokens: usage.inputTokens,
                    completionTokens: usage.outputTokens,
                    totalTokens: usage.totalTokens,
                    costUsd: usage.estimatedCostUsd ?? 0
                  }
                : undefined,
              usageWasEstimated: usage?.wasEstimated,
              providerId: usage?.providerId,
              providerName: usage?.providerName,
              modelName: usage?.modelName,
              usageRecordId: usage?.id,
              extraLogs: [
                ...executionLogs,
                createLogEntry(
                  `CLI agent ${result.provider} finished${result.ok ? "" : " with errors"}`,
                  result.ok ? "success" : "warning"
                ),
                createLogEntry("CLI output saved for review", result.ok ? "success" : "warning")
              ]
            }),
            reviewChecklist: {
              ...card.reviewChecklist,
              scopeMatchesPlan: result.ok,
              summaryIsClear: Boolean(result.summary)
            },
            activityLog: [
              ...card.activityLog,
              ...executionLogs,
              createLogEntry(
                `CLI agent ${result.provider} finished${result.ok ? "" : " with errors"}`,
                result.ok ? "success" : "warning"
              ),
              createLogEntry("CLI output saved for review", result.ok ? "success" : "warning")
            ],
            updatedAt: timestamp
          }
        : card
    ),
    providerUsageRecords: usage ? [...workspace.providerUsageRecords, usage] : workspace.providerUsageRecords,
    updatedAt: timestamp
  };
};

export const recordPatchApplyResult = (
  workspace: Workspace,
  cardId: string,
  result: { ok: boolean; output: string; backupPath?: string }
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            applyOutput: [result.output, result.backupPath ? `Backup: ${result.backupPath}` : ""].filter(Boolean).join("\n"),
            activityLog: [
              ...card.activityLog,
              createLogEntry(result.ok ? "Patch applied" : "Patch apply failed", result.ok ? "success" : "warning")
            ],
            updatedAt: timestamp
          }
        : card
    ),
    updatedAt: timestamp
  };
};

export const generatePrDraft = (workspace: Workspace, cardId: string): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            prTitle: card.prTitle || card.title,
            prDescription:
              card.prDescription ||
              [
                "## Summary",
                card.resultSummary || "Describe the change made by this agent task.",
                "",
                "## Review",
                "- Scope matches plan",
                "- Safety settings checked",
                "- User approval required before PR creation",
                "",
                "## Patch",
                card.patchText ? "Patch text is stored on this card." : "No patch text stored."
              ].join("\n"),
            activityLog: [...card.activityLog, createLogEntry("PR draft generated")],
            updatedAt: timestamp
          }
        : card
    ),
    updatedAt: timestamp
  };
};

export const recordCommandResult = (
  workspace: Workspace,
  cardId: string,
  kind: "test" | "build" | "commit" | "rollback",
  result: { ok: boolean; output: string }
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) => {
      if (card.id !== cardId) {
        return card;
      }

      return {
        ...card,
        testOutput: kind === "test" ? result.output : card.testOutput,
        buildOutput: kind === "build" ? result.output : card.buildOutput,
        applyOutput: kind === "commit" || kind === "rollback" ? result.output : card.applyOutput,
        sessions:
          kind === "test" || kind === "build"
            ? updateLatestSessionValidation(card, kind === "test" ? "Tests" : "Build", result.ok, result.output)
            : card.sessions,
        reviewChecklist: {
          ...card.reviewChecklist,
          buildTestPassed: kind === "test" || kind === "build" ? result.ok : card.reviewChecklist.buildTestPassed
        },
        activityLog: [
          ...card.activityLog,
          createLogEntry(
            `${labelForCommandKind(kind)} ${result.ok ? "passed" : "failed"}`,
            result.ok ? "success" : "warning"
          )
        ],
        updatedAt: timestamp
      };
    }),
    updatedAt: timestamp
  };
};

const labelForCommandKind = (kind: "test" | "build" | "commit" | "rollback") => {
  if (kind === "test") return "Test";
  if (kind === "build") return "Build";
  if (kind === "rollback") return "Rollback";
  return "Commit";
};

export const recordPrResult = (
  workspace: Workspace,
  cardId: string,
  result: { ok: boolean; output: string; url: string }
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            prUrl: result.url || card.prUrl,
            applyOutput: result.output,
            activityLog: [
              ...card.activityLog,
              createLogEntry(result.ok ? "Draft PR created" : "Draft PR creation failed", result.ok ? "success" : "warning")
            ],
            updatedAt: timestamp
          }
        : card
    ),
    updatedAt: timestamp
  };
};

const logsForMove = (card: KanbanCard, targetColumnId: BoardColumnId, workspace: Workspace) => {
  if (targetColumnId === "start-implement") {
    const model = workspace.modelProfiles.find((profile) => profile.id === card.modelProfileId);
    const cliTool = workspace.cliToolProfiles.find((profile) => profile.id === card.cliToolProfileId);
    const skills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
    return [
      createLogEntry("Moved to Start Implement"),
      createLogEntry("Execution preview created"),
      createLogEntry(buildExecutionPreview(card, model, skills, cliTool))
    ];
  }

  return [createLogEntry(`Moved to ${targetColumnId}`)];
};

const prepareCardForColumn = (
  workspace: Workspace,
  card: KanbanCard,
  targetColumnId: BoardColumnId
): { updates: Partial<KanbanCard>; warning?: string } => {
  if (targetColumnId === "my-plan") {
    const planAgent = resolvePlanAgent(workspace, card.planAgentProfileId || card.agentProfileId);
    if (!planAgent) {
      return { updates: {}, warning: "No Plan Agent is configured." };
    }
    return {
      updates: {
        agentProfileId: planAgent.id,
        planAgentProfileId: planAgent.id,
        skillIds: planAgent.skillIds,
        runnerType: planAgent.defaultRunnerType,
        modelProfileId: planAgent.defaultModelProfileId || workspace.defaultModelProfileId,
        cliToolProfileId: planAgent.defaultCliToolProfileId || workspace.defaultCliToolProfileId || undefined,
        executionMode: "Plan Only"
      }
    };
  }

  if (targetColumnId === "start-implement") {
    const implementAgent = resolveImplementAgent(workspace, card.implementAgentProfileId);
    if (!implementAgent) {
      return { updates: {}, warning: "No Implement Agent is configured." };
    }
    return {
      updates: {
        agentProfileId: implementAgent.id,
        implementAgentProfileId: implementAgent.id,
        skillIds: implementAgent.skillIds,
        runnerType: implementAgent.defaultRunnerType,
        modelProfileId: implementAgent.defaultModelProfileId || workspace.defaultModelProfileId,
        cliToolProfileId: implementAgent.defaultCliToolProfileId || workspace.defaultCliToolProfileId || undefined,
        executionMode: implementAgent.defaultExecutionMode,
        planCompletedAt: card.planCompletedAt || nowIso()
      }
    };
  }

  return { updates: {} };
};

const startImplementationSession = (
  workspace: Workspace,
  cardId: string,
  retryMode: SessionRetryMode,
  initialLogs: ReturnType<typeof createLogEntry>[]
): MoveCardResult => {
  const card = workspace.cards.find((item) => item.id === cardId);
  if (!card) {
    return { workspace };
  }

  if (card.columnId !== "start-implement") {
    return {
      workspace: appendCardLog(workspace, cardId, "Implementation can only start from Start Implement", "warning"),
      warning: "Move the card to Start Implement before starting a session."
    };
  }

  const implementAgent = workspace.agentProfiles.find((agent) => agent.id === (card.implementAgentProfileId || card.agentProfileId));
  if (!implementAgent || !supportsImplementMode(implementAgent)) {
    return {
      workspace: appendCardLog(workspace, cardId, "No Implement Agent is configured.", "warning"),
      warning: "No Implement Agent is configured."
    };
  }

  const blockedDependency = card.dependencyCardIds
    .map((dependencyId) => workspace.cards.find((item) => item.id === dependencyId))
    .find((dependency) => dependency && dependency.columnId !== "done");

  if (blockedDependency) {
    return {
      workspace: appendCardLog(workspace, cardId, `Blocked by dependency: ${blockedDependency.title}`, "warning"),
      warning: `This task is blocked by dependency: ${blockedDependency.title}.`
    };
  }

  const timestamp = nowIso();
  const implementationCard = {
    ...card,
    agentProfileId: implementAgent.id,
    implementAgentProfileId: implementAgent.id
  };
  const model = workspace.modelProfiles.find((profile) => profile.id === card.modelProfileId);
  const cliTool = workspace.cliToolProfiles.find((profile) => profile.id === card.cliToolProfileId);
  const skills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
  const session = createImplementationSession(
    implementationCard,
    workspace,
    buildExecutionPreview(implementationCard, model, skills, cliTool),
    retryMode,
    initialLogs
  );

  return {
    workspace: {
      ...workspace,
      cards: workspace.cards.map((item) =>
        item.id === cardId
          ? {
              ...item,
              columnId: "in-process",
              locked: true,
              agentProfileId: implementAgent.id,
              implementAgentProfileId: implementAgent.id,
              implementationStartedAt: timestamp,
              activeSessionId: session.id,
              sessions: [...item.sessions, session],
              activityLog: [...item.activityLog, ...initialLogs],
              updatedAt: timestamp
            }
          : item
      ),
      updatedAt: timestamp
    }
  };
};

const createImplementationSession = (
  card: KanbanCard,
  workspace: Workspace,
  promptPreview: string,
  retryMode: SessionRetryMode,
  initialLogs: ReturnType<typeof createLogEntry>[]
): ImplementationSession => {
  const timestamp = nowIso();
  const attemptNumber = card.sessions.length + 1;
  const model = workspace.modelProfiles.find((profile) => profile.id === card.modelProfileId);
  const cliTool = workspace.cliToolProfiles.find(
    (profile) => profile.id === (card.cliToolProfileId || workspace.defaultCliToolProfileId)
  );
  return {
    id: createId("session"),
    cardId: card.id,
    attemptNumber,
    status: "running",
    retryMode,
    selectedAgentProfileId: card.implementAgentProfileId || card.agentProfileId,
    runnerType: card.runnerType,
    modelProfileId: card.modelProfileId,
    cliToolProfileId: card.cliToolProfileId || workspace.defaultCliToolProfileId || undefined,
    providerId: card.runnerType === "cli" ? cliTool?.providerId : model?.provider.toLowerCase().replace(/\s+/g, "-"),
    providerName: card.runnerType === "cli" ? cliTool?.displayName || cliTool?.name : model?.provider,
    modelName: card.runnerType === "api" ? model?.modelName : undefined,
    usageRecordId: undefined,
    usageWasEstimated: true,
    contextSnapshot: {
      title: card.title,
      description: card.description,
      skillIds: [...card.skillIds],
      executionMode: card.executionMode,
      projectContext: { ...card.projectContext },
      safetySettings: { ...card.safetySettings },
      validationRules: { ...card.validationRules },
      priority: card.priority,
      dependencyCardIds: [...card.dependencyCardIds]
    },
    promptPreview,
    logs: initialLogs,
    currentStep: initialLogs.at(-1)?.message ?? "Session started",
    changedFiles: [],
    diffText: "",
    summary: "",
    validationResults: createValidationResults(card),
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0
    },
    durationSeconds: 0,
    startedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

const createValidationResults = (card: KanbanCard): ValidationResult[] => {
  const timestamp = nowIso();
  const rules = [
    ["Build", card.validationRules.runBuild],
    ["Lint", card.validationRules.runLint],
    ["Tests", card.validationRules.runTests],
    ["Formatting", card.validationRules.checkFormatting]
  ] as const;

  return rules.map(([name, enabled]) => ({
    id: createId("validation"),
    name,
    status: enabled ? "pending" : "skipped",
    output: enabled ? "Waiting for validation." : "Validation disabled for this session.",
    completedAt: enabled ? undefined : timestamp
  }));
};

const completeActiveSession = (
  card: KanbanCard,
  updates: {
    status: ImplementationSession["status"];
    summary: string;
    diffText: string;
    currentStep: string;
    completedAt: string;
    tokenUsage?: ImplementationSession["tokenUsage"];
    usageWasEstimated?: boolean;
    providerId?: string;
    providerName?: string;
    modelName?: string;
    usageRecordId?: string;
    extraLogs: ReturnType<typeof createLogEntry>[];
  }
): ImplementationSession[] =>
  card.sessions.map((session) =>
    session.id === card.activeSessionId
      ? {
          ...session,
          status: updates.status,
          summary: updates.summary,
          diffText: updates.diffText,
          currentStep: updates.currentStep,
          tokenUsage: updates.tokenUsage ?? session.tokenUsage,
          usageWasEstimated: updates.usageWasEstimated ?? session.usageWasEstimated,
          providerId: updates.providerId ?? session.providerId,
          providerName: updates.providerName ?? session.providerName,
          modelName: updates.modelName ?? session.modelName,
          usageRecordId: updates.usageRecordId ?? session.usageRecordId,
          logs: [...session.logs, ...updates.extraLogs],
          durationSeconds: Math.max(
            0,
            Math.round((new Date(updates.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
          ),
          completedAt: updates.completedAt,
          updatedAt: updates.completedAt
        }
      : session
  );

const updateLatestReviewableSession = (
  card: KanbanCard,
  action: "approve" | "request-changes" | "retry" | "rollback"
): ImplementationSession[] => {
  if (action !== "approve" && action !== "request-changes") {
    return card.sessions;
  }

  const timestamp = nowIso();
  const targetSessionId = card.activeSessionId ?? card.sessions.at(-1)?.id;
  return card.sessions.map((session) =>
    session.id === targetSessionId
      ? {
          ...session,
          status: action === "approve" ? "approved" : "rejected",
          logs: [
            ...session.logs,
            createLogEntry(action === "approve" ? "Session approved by user" : "Session rejected by user", action === "approve" ? "success" : "warning")
          ],
          updatedAt: timestamp
        }
      : session
  );
};

const updateLatestSessionValidation = (
  card: KanbanCard,
  validationName: "Tests" | "Build",
  ok: boolean,
  output: string
): ImplementationSession[] => {
  const timestamp = nowIso();
  const targetSessionId = card.activeSessionId ?? card.sessions.at(-1)?.id;
  return card.sessions.map((session) =>
    session.id === targetSessionId
      ? {
          ...session,
          validationResults: session.validationResults.map((result) =>
            result.name === validationName
              ? {
                  ...result,
                  status: ok ? "passed" : "failed",
                  output,
                  completedAt: timestamp
                }
              : result
          ),
          updatedAt: timestamp
        }
      : session
  );
};
