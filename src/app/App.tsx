import { useEffect, useMemo, useState } from "react";
import { Board } from "../components/board/Board";
import { CardDetailDrawer } from "../components/drawer/CardDetailDrawer";
import { Sidebar } from "../components/sidebar/Sidebar";
import { runPlanOnly } from "../agent/agentRunner";
import { createAgentProfile, deleteAgentProfile, updateAgentProfile } from "../domain/agentService";
import {
  applyReviewAction,
  cancelExecution,
  completePlanOnlyExecution,
  createCard,
  deleteCard,
  duplicateCard,
  moveCard,
  simulateExecution,
  startPlanOnlyExecution,
  updateCard
} from "../domain/boardService";
import { createId, nowIso } from "../domain/id";
import { createModelProfile, deleteModelProfile, updateModelProfile } from "../domain/modelService";
import { createSkill, deleteSkill, duplicateSkill, updateSkill } from "../domain/skillService";
import type { AppState, BoardColumnId, KanbanCard, Workspace } from "../domain/types";
import { loadAppState, resetAppState, saveAppState } from "../storage/localStorageRepository";

export const App = () => {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const activeWorkspace = useMemo(
    () => state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? state.workspaces[0],
    [state]
  );

  const selectedCard = activeWorkspace?.cards.find((card) => card.id === selectedCardId);

  const updateActiveWorkspace = (updater: (workspace: Workspace) => Workspace) => {
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? updater(workspace) : workspace
      )
    }));
  };

  const handleCreateWorkspace = () => {
    const timestamp = nowIso();
    const workspaceId = createId("workspace");
    const workspace: Workspace = {
      id: workspaceId,
      name: "New Workspace",
      repoPath: "",
      defaultBranch: "main",
      defaultModelProfileId: "",
      defaultAgentProfileId: "",
      allowedEditableFolders: "",
      blockedFilePatterns: ".env, *.pem, *.key",
      testCommand: "",
      buildCommand: "",
      cards: [],
      skills: [],
      modelProfiles: [],
      agentProfiles: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };

    setState((current) => ({
      activeWorkspaceId: workspaceId,
      workspaces: [workspace, ...current.workspaces]
    }));
    setSelectedCardId(null);
  };

  const handleDeleteWorkspace = (workspaceId: string) => {
    if (state.workspaces.length === 1) {
      return;
    }

    setState((current) => {
      const workspaces = current.workspaces.filter((workspace) => workspace.id !== workspaceId);
      return {
        activeWorkspaceId:
          current.activeWorkspaceId === workspaceId ? workspaces[0]?.id ?? current.activeWorkspaceId : current.activeWorkspaceId,
        workspaces
      };
    });
    setSelectedCardId(null);
  };

  if (!activeWorkspace) {
    return null;
  }

  const handleMoveCard = (cardId: string, targetColumnId: BoardColumnId) => {
    const result = moveCard(activeWorkspace, cardId, targetColumnId);
    setWarning(result.warning ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? result.workspace : workspace
      )
    }));
  };

  const handleCreateCard = (columnId: BoardColumnId) => {
    const next = createCard(activeWorkspace, columnId);
    setSelectedCardId(next.cards[0]?.id ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? next : workspace
      )
    }));
  };

  const handleRunPlanOnly = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    const startedWorkspace = startPlanOnlyExecution(activeWorkspace, cardId);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? startedWorkspace : workspace
      )
    }));

    const result = await runPlanOnly(activeWorkspace, card);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? completePlanOnlyExecution(workspace, cardId, result) : workspace
      )
    }));
  };

  const handleDeleteCard = (cardId: string) => {
    updateActiveWorkspace((workspace) => deleteCard(workspace, cardId));
    setSelectedCardId(null);
  };

  const handleDuplicateCard = (cardId: string) => {
    updateActiveWorkspace((workspace) => duplicateCard(workspace, cardId));
  };

  return (
    <div className="app-shell">
      <Sidebar
        state={state}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={(workspaceId) => {
          setState((current) => ({ ...current, activeWorkspaceId: workspaceId }));
          setSelectedCardId(null);
        }}
        onCreateWorkspace={handleCreateWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
        onUpdateWorkspace={(updates) => {
          updateActiveWorkspace((workspace) => ({ ...workspace, ...updates, updatedAt: nowIso() }));
        }}
        onReset={() => {
          setState(resetAppState());
          setSelectedCardId(null);
        }}
        onCreateSkill={() => updateActiveWorkspace(createSkill)}
        onUpdateSkill={(skillId, updates) => updateActiveWorkspace((workspace) => updateSkill(workspace, skillId, updates))}
        onDuplicateSkill={(skillId) => updateActiveWorkspace((workspace) => duplicateSkill(workspace, skillId))}
        onDeleteSkill={(skillId) => updateActiveWorkspace((workspace) => deleteSkill(workspace, skillId))}
        onCreateModel={() => updateActiveWorkspace(createModelProfile)}
        onUpdateModel={(modelId, updates) =>
          updateActiveWorkspace((workspace) => updateModelProfile(workspace, modelId, updates))
        }
        onDeleteModel={(modelId) => updateActiveWorkspace((workspace) => deleteModelProfile(workspace, modelId))}
        onCreateAgent={() => updateActiveWorkspace(createAgentProfile)}
        onUpdateAgent={(agentId, updates) =>
          updateActiveWorkspace((workspace) => updateAgentProfile(workspace, agentId, updates))
        }
        onDeleteAgent={(agentId) => updateActiveWorkspace((workspace) => deleteAgentProfile(workspace, agentId))}
      />

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Agent workflow control panel</p>
            <h1>{activeWorkspace.name}</h1>
          </div>
          <div className="topbar-meta">
            <span>{activeWorkspace.cards.length} cards</span>
            <span>{activeWorkspace.skills.length} skills</span>
            <span>{activeWorkspace.modelProfiles.length} models</span>
          </div>
        </header>

        {warning ? (
          <button className="warning-banner" type="button" onClick={() => setWarning(null)}>
            {warning}
          </button>
        ) : null}

        <Board
          workspace={activeWorkspace}
          selectedCardId={selectedCardId}
          onSelectCard={setSelectedCardId}
          onCreateCard={handleCreateCard}
          onMoveCard={handleMoveCard}
        />
      </main>

      <CardDetailDrawer
        card={selectedCard}
        workspace={activeWorkspace}
        onClose={() => setSelectedCardId(null)}
        onUpdateCard={(cardId: string, updates: Partial<KanbanCard>) =>
          updateActiveWorkspace((workspace) => updateCard(workspace, cardId, updates))
        }
        onDeleteCard={handleDeleteCard}
        onDuplicateCard={handleDuplicateCard}
        onReviewAction={(cardId, action) =>
          updateActiveWorkspace((workspace) => applyReviewAction(workspace, cardId, action))
        }
        onSimulateExecution={(cardId) => updateActiveWorkspace((workspace) => simulateExecution(workspace, cardId))}
        onCancelExecution={(cardId) => updateActiveWorkspace((workspace) => cancelExecution(workspace, cardId))}
        onRunPlanOnly={handleRunPlanOnly}
      />
    </div>
  );
};
