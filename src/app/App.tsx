import { useEffect, useMemo, useState } from "react";
import { Board } from "../components/board/Board";
import { CardDetailDrawer } from "../components/drawer/CardDetailDrawer";
import { SettingsModal } from "../components/settings/SettingsModal";
import { Sidebar } from "../components/sidebar/Sidebar";
import { TopNav } from "../components/topnav/TopNav";
import { runPlanOnly } from "../agent/agentRunner";
import { runCliAgent } from "../agent/cliRunner";
import { repoBridge } from "../desktop/repoBridge";
import { createAgentProfile, deleteAgentProfile, updateAgentProfile } from "../domain/agentService";
import { createCliToolProfile, deleteCliToolProfile, updateCliToolProfile } from "../domain/cliToolService";
import { createDefaultCliToolProfiles } from "../domain/defaults";
import {
  applyReviewAction,
  appendCardLog,
  cancelExecution,
  completePlanOnlyExecution,
  completeCliExecution,
  createCard,
  deleteCard,
  duplicateCard,
  moveCard,
  generatePrDraft,
  recordCommandResult,
  recordPatchApplyResult,
  recordPrResult,
  simulateExecution,
  startCliExecution,
  startPlanOnlyExecution,
  updateCard
} from "../domain/boardService";
import { createId, nowIso } from "../domain/id";
import { createModelProfile, deleteModelProfile, updateModelProfile } from "../domain/modelService";
import { createSkill, deleteSkill, duplicateSkill, updateSkill } from "../domain/skillService";
import type { AppState, BoardColumnId, KanbanCard, Workspace } from "../domain/types";
import { loadAppState, resetAppState, saveAppState } from "../storage/localStorageRepository";
import { loadThemeMode, resolveThemeMode, saveThemeMode, type ThemeMode } from "./theme";

export const App = () => {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSkillId, setFilterSkillId] = useState("");
  const [filterModelId, setFilterModelId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [compactBoard, setCompactBoard] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.dataset.theme = resolveThemeMode(themeMode);
      document.documentElement.dataset.themeMode = themeMode;
    };

    applyTheme();
    saveThemeMode(themeMode);

    if (themeMode !== "system") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode]);

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
    const cliToolProfiles = createDefaultCliToolProfiles();
    const workspace: Workspace = {
      id: workspaceId,
      name: "New Workspace",
      repoPath: "",
      defaultBranch: "main",
      defaultModelProfileId: "",
      defaultAgentProfileId: "",
      defaultCliToolProfileId: cliToolProfiles[0]?.id ?? "",
      allowedEditableFolders: "",
      blockedFilePatterns: ".env, *.pem, *.key",
      testCommand: "",
      buildCommand: "",
      cards: [],
      skills: [],
      modelProfiles: [],
      cliToolProfiles,
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

  const inspectWorkspaceRepo = async (workspace: Workspace): Promise<Workspace> => {
    const inspection = await repoBridge.inspect({
      allowedEditableFolders: workspace.allowedEditableFolders,
      blockedFilePatterns: workspace.blockedFilePatterns,
      repoPath: workspace.repoPath
    });

    return {
      ...workspace,
      repoInspection: inspection,
      updatedAt: nowIso()
    };
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

  const handleInspectRepo = async () => {
    const next = await inspectWorkspaceRepo(activeWorkspace);
    setWarning(next.repoInspection?.warnings[0] ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? next : workspace
      )
    }));
  };

  const handleSelectRepoFolder = async () => {
    const result = await repoBridge.selectFolder();
    if (!result.ok || !result.path) {
      setWarning(result.message);
      return;
    }

    const withPath = { ...activeWorkspace, repoPath: result.path, updatedAt: nowIso() };
    const inspected = await inspectWorkspaceRepo(withPath);
    setWarning(inspected.repoInspection?.warnings[0] ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? inspected : workspace
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

    const result = await runPlanOnly(activeWorkspace, card, (message) => {
      setState((current) => ({
        ...current,
        workspaces: current.workspaces.map((workspace) =>
          workspace.id === current.activeWorkspaceId ? appendCardLog(workspace, cardId, message) : workspace
        )
      }));
    }).catch((error: unknown) => ({
      provider: "runner",
      summary: "Plan Only execution failed.",
      rawText: error instanceof Error ? error.message : "Unknown Plan Only execution error."
    }));
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? completePlanOnlyExecution(workspace, cardId, result) : workspace
      )
    }));
  };

  const handleLoadAttachedFiles = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    const files = card.projectContext.targetFiles
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (files.length === 0) {
      setWarning("Attach at least one target file before loading file context.");
      return;
    }

    const loaded = await Promise.all(
      files.map(async (relativePath) => ({
        relativePath,
        result: await repoBridge.readFile({
          allowedEditableFolders: activeWorkspace.allowedEditableFolders,
          blockedFilePatterns: activeWorkspace.blockedFilePatterns,
          relativePath,
          repoPath: card.projectContext.repoPath || activeWorkspace.repoPath
        })
      }))
    );

    const firstFailure = loaded.find((item) => !item.result.ok);
    setWarning(firstFailure?.result.message ?? null);

    const attachedFileContext = loaded
      .filter((item) => item.result.ok)
      .map((item) => [`# ${item.relativePath}`, item.result.content].join("\n"))
      .join("\n\n---\n\n");

    updateActiveWorkspace((workspace) =>
      updateCard(workspace, cardId, {
        projectContext: {
          ...card.projectContext,
          attachedFileContext
        }
      })
    );
  };

  const handleRunCliAgent = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    if (card.locked) {
      setWarning("This card is locked by a running task.");
      return;
    }

    const profile = activeWorkspace.cliToolProfiles.find(
      (item) => item.id === (card.cliToolProfileId || activeWorkspace.defaultCliToolProfileId)
    );
    if (!profile) {
      setWarning("Select a CLI profile before running Claude Code / Codex.");
      return;
    }

    const startedWorkspace = startCliExecution(activeWorkspace, cardId);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? startedWorkspace : workspace
      )
    }));

    const result = await runCliAgent(activeWorkspace, card, profile).catch((error: unknown) => ({
      ok: false,
      provider: profile.name,
      summary: "CLI agent execution failed.",
      rawText: error instanceof Error ? error.message : "Unknown CLI execution error."
    }));

    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? completeCliExecution(workspace, cardId, result) : workspace
      )
    }));
  };

  const handleDeleteCard = (cardId: string) => {
    updateActiveWorkspace((workspace) => deleteCard(workspace, cardId));
    setSelectedCardId(null);
  };

  const handleGeneratePrDraft = (cardId: string) => {
    updateActiveWorkspace((workspace) => generatePrDraft(workspace, cardId));
  };

  const handleApplyPatch = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    if (!card.reviewChecklist.userApproved) {
      setWarning("Approve the review checklist before applying a patch.");
      return;
    }

    const patchText = card.patchText || card.diffPlaceholder;
    if (!patchText.trim()) {
      setWarning("No patch text is saved on this card.");
      return;
    }

    const result = await repoBridge.applyPatch({
      allowedEditableFolders: activeWorkspace.allowedEditableFolders,
      blockedFilePatterns: activeWorkspace.blockedFilePatterns,
      patchText,
      repoPath: card.projectContext.repoPath || activeWorkspace.repoPath
    });
    setWarning(result.ok ? null : result.output);
    updateActiveWorkspace((workspace) => recordPatchApplyResult(workspace, cardId, result));
  };

  const handleRunWorkspaceCommand = async (cardId: string, kind: "test" | "build") => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    const command = kind === "test" ? activeWorkspace.testCommand : activeWorkspace.buildCommand;
    const result = await repoBridge.runCommand({
      command,
      repoPath: card.projectContext.repoPath || activeWorkspace.repoPath
    });
    setWarning(result.ok ? null : result.output);
    updateActiveWorkspace((workspace) => recordCommandResult(workspace, cardId, kind, result));
  };

  const handleCommit = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    if (card.safetySettings.requireApprovalBeforeCommit && !card.reviewChecklist.userApproved) {
      setWarning("Approval is required before commit.");
      return;
    }

    const message = card.commitMessage || card.title;
    const result = await repoBridge.gitCommit({
      message,
      repoPath: card.projectContext.repoPath || activeWorkspace.repoPath
    });
    setWarning(result.ok ? null : result.output);
    updateActiveWorkspace((workspace) => recordCommandResult(workspace, cardId, "commit", result));
  };

  const handleRollbackFiles = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    const files = card.projectContext.targetFiles || card.projectContext.targetPaths;
    const result = await repoBridge.gitCheckoutFiles({
      files,
      repoPath: card.projectContext.repoPath || activeWorkspace.repoPath
    });
    setWarning(result.ok ? null : result.output);
    updateActiveWorkspace((workspace) => recordCommandResult(workspace, cardId, "rollback", result));
  };

  const handleCreatePr = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    if (card.safetySettings.requireApprovalBeforePr && !card.reviewChecklist.userApproved) {
      setWarning("Approval is required before creating a PR.");
      return;
    }

    const result = await repoBridge.githubPr({
      title: card.prTitle || card.title,
      body: card.prDescription || card.resultSummary,
      repoPath: card.projectContext.repoPath || activeWorkspace.repoPath
    });
    setWarning(result.ok ? null : result.output);
    updateActiveWorkspace((workspace) => recordPrResult(workspace, cardId, result));
  };

  const handleDuplicateCard = (cardId: string) => {
    updateActiveWorkspace((workspace) => duplicateCard(workspace, cardId));
  };

  return (
    <div className="app-shell">
      <TopNav
        activeWorkspace={activeWorkspace}
        searchQuery={searchQuery}
        workspaces={state.workspaces}
        onOpenSettings={() => setSettingsOpen(true)}
        onSearch={setSearchQuery}
        onSelectWorkspace={(workspaceId) => {
          setState((current) => ({ ...current, activeWorkspaceId: workspaceId }));
          setSelectedCardId(null);
        }}
      />

      <div className="app-body">
        <Sidebar
          state={state}
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={(workspaceId) => {
            setState((current) => ({ ...current, activeWorkspaceId: workspaceId }));
            setSelectedCardId(null);
          }}
          onCreateWorkspace={handleCreateWorkspace}
          onDeleteWorkspace={handleDeleteWorkspace}
          onInspectRepo={handleInspectRepo}
          onSelectRepoFolder={handleSelectRepoFolder}
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
          onCreateCliTool={() => updateActiveWorkspace(createCliToolProfile)}
          onUpdateCliTool={(profileId, updates) =>
            updateActiveWorkspace((workspace) => updateCliToolProfile(workspace, profileId, updates))
          }
          onDeleteCliTool={(profileId) => updateActiveWorkspace((workspace) => deleteCliToolProfile(workspace, profileId))}
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

        <section className="board-toolbar">
          <input
            aria-label="Search cards"
            placeholder="Search cards"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <select aria-label="Filter by skill" value={filterSkillId} onChange={(event) => setFilterSkillId(event.target.value)}>
            <option value="">All skills</option>
            {activeWorkspace.skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <select aria-label="Filter by model" value={filterModelId} onChange={(event) => setFilterModelId(event.target.value)}>
            <option value="">All models</option>
            {activeWorkspace.modelProfiles.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <select aria-label="Filter by status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="my-plan">My Plan</option>
            <option value="skill-used">Skill Used</option>
            <option value="start-implement">Start Implement</option>
            <option value="in-process">In Process</option>
            <option value="in-review">In Review</option>
            <option value="successfully">Successfully</option>
          </select>
          <label className="toolbar-toggle">
            <input checked={compactBoard} type="checkbox" onChange={(event) => setCompactBoard(event.target.checked)} />
            Compact
          </label>
        </section>

        <Board
          workspace={activeWorkspace}
          compact={compactBoard}
          filterModelId={filterModelId}
          filterSkillId={filterSkillId}
          filterStatus={filterStatus}
          searchQuery={searchQuery}
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
          onLoadAttachedFiles={handleLoadAttachedFiles}
          onRunCliAgent={handleRunCliAgent}
          onApplyPatch={handleApplyPatch}
          onRunWorkspaceCommand={handleRunWorkspaceCommand}
          onCommit={handleCommit}
          onGeneratePrDraft={handleGeneratePrDraft}
          onRollbackFiles={handleRollbackFiles}
          onCreatePr={handleCreatePr}
        />
      </div>

      {settingsOpen ? (
        <SettingsModal themeMode={themeMode} onClose={() => setSettingsOpen(false)} onThemeChange={setThemeMode} />
      ) : null}
    </div>
  );
};
