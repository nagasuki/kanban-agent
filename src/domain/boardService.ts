import {
  createDefaultProjectContext,
  createDefaultReviewChecklist,
  createDefaultSafetySettings,
  createLogEntry
} from "./defaults";
import { buildExecutionPreview, createImplementationLogBurst } from "./executionService";
import { createId, nowIso } from "./id";
import type { BoardColumnId, KanbanCard, Workspace } from "./types";

export interface MoveCardResult {
  workspace: Workspace;
  warning?: string;
}

export const createCard = (workspace: Workspace, columnId: BoardColumnId): Workspace => {
  const timestamp = nowIso();
  const defaultAgent = workspace.agentProfiles.find((profile) => profile.id === workspace.defaultAgentProfileId);
  const card: KanbanCard = {
    id: createId("card"),
    workspaceId: workspace.id,
    columnId,
    title: "Untitled agent task",
    description: "Write the implementation plan here.",
    skillIds: defaultAgent?.skillIds ?? [],
    modelProfileId: workspace.defaultModelProfileId,
    agentProfileId: defaultAgent?.id,
    executionMode: defaultAgent?.defaultExecutionMode ?? "Suggest Patch",
    projectContext: createDefaultProjectContext(workspace.repoPath),
    safetySettings: createDefaultSafetySettings(),
    reviewChecklist: createDefaultReviewChecklist(),
    activityLog: [createLogEntry("Card created")],
    resultSummary: "",
    diffPlaceholder: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...workspace,
    cards: [card, ...workspace.cards],
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

  if (targetColumnId === "successfully" && !card.reviewChecklist.userApproved) {
    return {
      workspace: appendCardLog(workspace, cardId, "Successfully requires review approval first", "warning"),
      warning: "Approve the review checklist before moving this card to Successfully."
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
      columnId: targetColumnId,
      activityLog: logs,
      resultSummary:
        targetColumnId === "in-review" && !item.resultSummary
          ? "Simulated implementation completed. Review the checklist, logs, and placeholder diff."
          : item.resultSummary,
      diffPlaceholder:
        targetColumnId === "in-review" && !item.diffPlaceholder
          ? "Diff placeholder: no files changed yet because AI execution is not connected."
          : item.diffPlaceholder,
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
            activityLog: [...card.activityLog, createLogEntry(message, level)],
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
    "request-changes": "Changes requested",
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

      return {
        ...card,
        columnId: action === "retry" ? "start-implement" : card.columnId,
        reviewChecklist:
          action === "approve"
            ? {
                ...card.reviewChecklist,
                userApproved: true,
                summaryIsClear: true
              }
            : card.reviewChecklist,
        activityLog: [...card.activityLog, createLogEntry(messages[action], action === "approve" ? "success" : "info")],
        updatedAt: timestamp
      };
    }),
    updatedAt: timestamp
  };
};

export const simulateExecution = (workspace: Workspace, cardId: string): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cards: workspace.cards.map((card) => {
      if (card.id !== cardId) {
        return card;
      }

      if (card.columnId !== "in-process") {
        return {
          ...card,
          columnId: "in-process",
          activityLog: [
            ...card.activityLog,
            createLogEntry("Fake runner started"),
            createLogEntry("Implementation started"),
            ...createImplementationLogBurst()
          ],
          updatedAt: timestamp
        };
      }

      return {
        ...card,
        columnId: "in-review",
        resultSummary:
          card.resultSummary ||
          "Fake runner completed. The task is ready for human review before any real file operations exist.",
        diffPlaceholder:
          card.diffPlaceholder ||
          "Diff placeholder: fake runner generated no real patch. Future Suggest Patch mode will populate this.",
        reviewChecklist: {
          ...card.reviewChecklist,
          scopeMatchesPlan: true,
          summaryIsClear: true
        },
        activityLog: [
          ...card.activityLog,
          createLogEntry("Fake runner generated result summary"),
          createLogEntry("Implementation completed and ready for review", "success")
        ],
        updatedAt: timestamp
      };
    }),
    updatedAt: timestamp
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
            activityLog: [...card.activityLog, createLogEntry("Execution cancelled", "warning")],
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
    const skills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
    return [
      createLogEntry("Moved to Start Implement"),
      createLogEntry("Execution preview created"),
      createLogEntry(buildExecutionPreview(card, model, skills))
    ];
  }

  if (targetColumnId === "in-process") {
    return [createLogEntry("Implementation started"), ...createImplementationLogBurst()];
  }

  if (targetColumnId === "in-review") {
    return [createLogEntry("Implementation completed and ready for review", "success")];
  }

  if (targetColumnId === "successfully") {
    return [createLogEntry("Work marked successfully completed", "success")];
  }

  return [createLogEntry(`Moved to ${targetColumnId}`)];
};
