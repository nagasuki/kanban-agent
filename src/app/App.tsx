import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "../components/board/Board";
import { CardDetailModal } from "../components/drawer/CardDetailDrawer";
import { PlanPromptModal } from "../components/plans/PlanPromptModal";
import { SettingsModal } from "../components/settings/SettingsModal";
import { TopNav } from "../components/topnav/TopNav";
import { runPlanDraft, runPlanOnly } from "../agent/agentRunner";
import { runCliAgent, runCliPlanDraft } from "../agent/cliRunner";
import { cliBridge, type CliValidationResult } from "../desktop/cliBridge";
import { repoBridge } from "../desktop/repoBridge";
import { createAgentProfile, deleteAgentProfile, updateAgentProfile } from "../domain/agentService";
import {
  getImplementCapableAgents,
  getPlanCapableAgents,
  resolveImplementAgent,
  resolveImplementAgentForCard,
  resolvePlanAgent,
  supportsImplementMode
} from "../domain/agentCapabilities";
import { createCliToolProfile, deleteCliToolProfile, updateCliToolProfile } from "../domain/cliToolService";
import { createDefaultCliToolProfiles } from "../domain/defaults";
import {
  applyReviewAction,
  appendCardLog,
  cancelExecution,
  completePlanDraft,
  completePlanOnlyExecution,
  completeCliExecution,
  createCard,
  createPlanCardFromPrompt,
  deleteCard,
  duplicateCard,
  moveCard,
  reorderCard,
  generatePrDraft,
  recordCommandResult,
  recordPatchApplyResult,
  recordPrResult,
  simulateExecution,
  startCliExecution,
  startPlanOnlyExecution,
  updateActiveSessionUsage,
  updateCard
} from "../domain/boardService";
import type { CreatePlanCardOptions } from "../domain/boardService";
import { createId, nowIso } from "../domain/id";
import { createModelProfile, deleteModelProfile, updateModelProfile } from "../domain/modelService";
import { createSkill, deleteSkill, duplicateSkill, updateSkill } from "../domain/skillService";
import type { AppState, BoardColumnId, CliToolProfile, KanbanCard, SessionRetryMode, Workspace } from "../domain/types";
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
  const [planPromptOpen, setPlanPromptOpen] = useState(false);
  const cancelledPlanIdsRef = useRef<Set<string>>(new Set());
  const planAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
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

  const folderNameFromPath = (folderPath: string): string =>
    folderPath
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .filter(Boolean)
      .at(-1) || "New Project";

  const handleCreateWorkspace = async () => {
    const result = await repoBridge.selectFolder();
    if (!result.ok || !result.path) {
      setWarning(result.message);
      return;
    }

    const timestamp = nowIso();
    const workspaceId = createId("workspace");
    const cliToolProfiles = createDefaultCliToolProfiles();
    const workspace: Workspace = {
      id: workspaceId,
      name: folderNameFromPath(result.path),
      repoPath: result.path,
      versionControlProvider: "auto",
      defaultBranch: "main",
      defaultModelProfileId: "",
      defaultAgentProfileId: "",
      defaultPlanAgentProfileId: "",
      defaultImplementAgentProfileId: "",
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
      providerUsageRecords: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const inspected = await inspectWorkspaceRepo(workspace);

    setState((current) => ({
      activeWorkspaceId: workspaceId,
      workspaces: [inspected, ...current.workspaces]
    }));
    setWarning(inspected.repoInspection?.warnings[0] ?? null);
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
      repoPath: workspace.repoPath,
      versionControlProvider: workspace.versionControlProvider
    });

    return {
      ...workspace,
      defaultBranch: inspection.currentBranch || workspace.defaultBranch,
      repoInspection: inspection,
      updatedAt: nowIso()
    };
  };

  if (!activeWorkspace) {
    return null;
  }

  const selectedPlanColumnAgentId =
    getPlanCapableAgents(activeWorkspace).find((agent) => agent.id === activeWorkspace.defaultPlanAgentProfileId)?.id ??
    getPlanCapableAgents(activeWorkspace)[0]?.id ??
    "";
  const selectedImplementColumnAgentId =
    getImplementCapableAgents(activeWorkspace).find((agent) => agent.id === activeWorkspace.defaultImplementAgentProfileId)?.id ??
    getImplementCapableAgents(activeWorkspace)[0]?.id ??
    "";

  const handleColumnAgentChange = (columnId: "my-plan" | "start-implement", agentId: string) => {
    if (columnId === "my-plan") {
      const agent = resolvePlanAgent(activeWorkspace, agentId);
      if (!agent) {
        setWarning("No Plan Agent is configured. Please set up a Plan Agent first.");
        return;
      }
      updateActiveWorkspace((workspace) => ({ ...workspace, defaultPlanAgentProfileId: agent.id, updatedAt: nowIso() }));
      return;
    }

    const agent = resolveImplementAgent(activeWorkspace, agentId);
    if (!agent) {
      setWarning("No Implement Agent is configured. Please set up an Implement Agent first.");
      return;
    }
    updateActiveWorkspace((workspace) => ({ ...workspace, defaultImplementAgentProfileId: agent.id, updatedAt: nowIso() }));
  };

  const handleMoveCard = (cardId: string, targetColumnId: BoardColumnId) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    let workspaceForMove = activeWorkspace;
    if (targetColumnId === "start-implement") {
      const implementAgent = resolveImplementAgentForCard(card, activeWorkspace, selectedImplementColumnAgentId);
      if (!implementAgent) {
        setWarning("No Implement Agent is configured. Please set up an Implement Agent first.");
        return;
      }
      workspaceForMove = updateCard(activeWorkspace, cardId, { implementAgentProfileId: implementAgent.id });
    }
    if (targetColumnId === "my-plan") {
      const planAgent = resolvePlanAgent(activeWorkspace, card.planAgentProfileId || selectedPlanColumnAgentId);
      if (!planAgent) {
        setWarning("No Plan Agent is configured. Please set up a Plan Agent first.");
        return;
      }
      workspaceForMove = updateCard(activeWorkspace, cardId, { planAgentProfileId: planAgent.id });
    }
    const result = moveCard(workspaceForMove, cardId, targetColumnId);
    setWarning(result.warning ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? result.workspace : workspace
      )
    }));
  };

  const handleReorderCard = (cardId: string, targetColumnId: BoardColumnId, targetIndex: number) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    let workspaceForMove = activeWorkspace;
    if (targetColumnId === "start-implement") {
      const implementAgent = resolveImplementAgentForCard(card, activeWorkspace, selectedImplementColumnAgentId);
      if (!implementAgent) {
        setWarning("No Implement Agent is configured. Please set up an Implement Agent first.");
        return;
      }
      workspaceForMove = updateCard(activeWorkspace, cardId, { implementAgentProfileId: implementAgent.id });
    }
    if (targetColumnId === "my-plan") {
      const planAgent = resolvePlanAgent(activeWorkspace, card.planAgentProfileId || selectedPlanColumnAgentId);
      if (!planAgent) {
        setWarning("No Plan Agent is configured. Please set up a Plan Agent first.");
        return;
      }
      workspaceForMove = updateCard(activeWorkspace, cardId, { planAgentProfileId: planAgent.id });
    }
    const result = reorderCard(workspaceForMove, cardId, targetColumnId, targetIndex);
    setWarning(result.warning ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? result.workspace : workspace
      )
    }));
  };

  const handleCreateCard = (columnId: BoardColumnId) => {
    if (columnId === "my-plan") {
      if (!selectedPlanColumnAgentId) {
        setWarning("No Plan Agent is configured. Please set up a Plan Agent first.");
        return;
      }
      setPlanPromptOpen(true);
      return;
    }

    const next = createCard(activeWorkspace, columnId);
    setSelectedCardId(next.cards[0]?.id ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? next : workspace
      )
    }));
  };

  const handleCreatePlanFromPrompt = async (prompt: string, options: CreatePlanCardOptions) => {
    const created = createPlanCardFromPrompt(activeWorkspace, prompt, options);
    setWarning(created.warning ?? null);
    if (created.warning || !created.cardId) {
      return;
    }

    const draftCard = created.workspace.cards.find((card) => card.id === created.cardId);
    if (!draftCard) {
      return;
    }

    setPlanPromptOpen(false);
    cancelledPlanIdsRef.current.delete(draftCard.id);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? created.workspace : workspace
      )
    }));

    const abortController = draftCard.runnerType === "api" ? new AbortController() : undefined;
    if (abortController) {
      planAbortControllersRef.current.set(draftCard.id, abortController);
    }

    const cliProfile = created.workspace.cliToolProfiles.find(
      (profile) => profile.id === (draftCard.cliToolProfileId || created.workspace.defaultCliToolProfileId)
    ) ?? created.workspace.cliToolProfiles[0];

    const result =
      draftCard.runnerType === "cli"
        ? cliProfile
          ? await runCliPlanDraft(created.workspace, draftCard, cliProfile, (message) => {
              if (!message) {
                return;
              }
              setState((current) => ({
                ...current,
                workspaces: current.workspaces.map((workspace) =>
                  workspace.id === current.activeWorkspaceId ? appendCardLog(workspace, draftCard.id, message) : workspace
                )
              }));
            }).catch((error: unknown) => ({
              ok: false,
              provider: "CLI",
              summary: "CLI plan generation failed.",
              rawText: error instanceof Error ? error.message : "Unknown CLI plan generation error."
            }))
          : {
            ok: false,
            provider: "CLI",
            summary: "CLI plan generation failed.",
            rawText: "Select a CLI profile before generating a plan with CLI Agent."
          }
        : await runPlanDraft(created.workspace, draftCard, (message) => {
            setState((current) => ({
              ...current,
              workspaces: current.workspaces.map((workspace) =>
                workspace.id === current.activeWorkspaceId ? appendCardLog(workspace, draftCard.id, message) : workspace
              )
            }));
          }, abortController?.signal)
            .then((apiResult) => ({ ...apiResult, ok: true }))
            .catch((error: unknown) => ({
              ok: false,
              provider: "API Model",
              summary: abortController?.signal.aborted ? "API plan generation cancelled." : "API plan generation failed.",
              rawText: abortController?.signal.aborted
                ? "Plan generation cancelled by user."
                : error instanceof Error
                  ? error.message
                  : "Unknown API plan generation error."
            }));

    planAbortControllersRef.current.delete(draftCard.id);
    if (cancelledPlanIdsRef.current.has(draftCard.id)) {
      cancelledPlanIdsRef.current.delete(draftCard.id);
      return;
    }

    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? completePlanDraft(workspace, draftCard.id, result) : workspace
      )
    }));
    setWarning(result.ok ? null : result.rawText);
  };

  const handleCreateManualPlan = (prompt: string, options: CreatePlanCardOptions) => {
    const created = createPlanCardFromPrompt(activeWorkspace, prompt, options);
    setWarning(created.warning ?? null);
    if (created.warning || !created.cardId) {
      return;
    }

    const completedWorkspace = completePlanDraft(created.workspace, created.cardId, {
      ok: true,
      provider: "Manual Plan",
      summary: prompt,
      rawText: prompt
    });
    setPlanPromptOpen(false);
    setSelectedCardId(created.cardId);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? completedWorkspace : workspace
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

    const withPath = {
      ...activeWorkspace,
      name: folderNameFromPath(result.path),
      repoPath: result.path,
      updatedAt: nowIso()
    };
    const inspected = await inspectWorkspaceRepo(withPath);
    setWarning(inspected.repoInspection?.warnings[0] ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? inspected : workspace
      )
    }));
  };

  const handleSwitchBranch = async (branch: string) => {
    if (!activeWorkspace.repoInspection || activeWorkspace.repoInspection.versionControlProvider === "none") {
      setWarning("Inspect a Git repository or Plastic workspace before switching branches.");
      return;
    }

    const result = await repoBridge.switchBranch({
      branch,
      repoPath: activeWorkspace.repoPath,
      versionControlProvider: activeWorkspace.repoInspection.versionControlProvider
    });
    if (!result.ok) {
      setWarning(result.output);
      return;
    }

    const inspected = await inspectWorkspaceRepo({
      ...activeWorkspace,
      defaultBranch: branch
    });
    setWarning(inspected.repoInspection?.warnings[0] ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? inspected : workspace
      )
    }));
  };

  const handleRunPlanOnly = async (cardId: string, retryMode: SessionRetryMode = "fresh") => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    const implementAgent = resolveImplementAgentForCard(card, activeWorkspace, selectedImplementColumnAgentId);
    if (!supportsImplementMode(implementAgent)) {
      setWarning("No Implement Agent is configured. Please set up an Implement Agent first.");
      return;
    }
    if (implementAgent.defaultRunnerType !== "api") {
      setWarning("The selected Implement Agent is configured for CLI. Use the CLI runner for this card.");
      return;
    }

    const workspaceForRun = updateCard(activeWorkspace, cardId, {
      agentProfileId: implementAgent.id,
      implementAgentProfileId: implementAgent.id,
      skillIds: implementAgent.skillIds,
      runnerType: implementAgent.defaultRunnerType,
      modelProfileId: implementAgent.defaultModelProfileId || activeWorkspace.defaultModelProfileId,
      cliToolProfileId: implementAgent.defaultCliToolProfileId || activeWorkspace.defaultCliToolProfileId || undefined,
      executionMode: implementAgent.defaultExecutionMode
    });
    const started = startPlanOnlyExecution(workspaceForRun, cardId, retryMode);
    setWarning(started.warning ?? null);
    if (started.warning) {
      setState((current) => ({
        ...current,
        workspaces: current.workspaces.map((workspace) =>
          workspace.id === current.activeWorkspaceId ? started.workspace : workspace
        )
      }));
      return;
    }
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? started.workspace : workspace
      )
    }));

    const runningCard = started.workspace.cards.find((item) => item.id === cardId) ?? card;
    const result = await runPlanOnly(started.workspace, runningCard, (message) => {
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

  const handleRunCliAgent = async (cardId: string, retryMode: SessionRetryMode = "fresh") => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    if (card.locked) {
      setWarning("This card is locked by a running task.");
      return;
    }
    const implementAgent = resolveImplementAgentForCard(card, activeWorkspace, selectedImplementColumnAgentId);
    if (!supportsImplementMode(implementAgent)) {
      setWarning("No Implement Agent is configured. Please set up an Implement Agent first.");
      return;
    }
    if (implementAgent.defaultRunnerType !== "cli") {
      setWarning("The selected Implement Agent is configured for API Model. Use the API runner for this card.");
      return;
    }

    const workspaceForRun = updateCard(activeWorkspace, cardId, {
      agentProfileId: implementAgent.id,
      implementAgentProfileId: implementAgent.id,
      skillIds: implementAgent.skillIds,
      runnerType: implementAgent.defaultRunnerType,
      modelProfileId: implementAgent.defaultModelProfileId || activeWorkspace.defaultModelProfileId,
      cliToolProfileId: implementAgent.defaultCliToolProfileId || activeWorkspace.defaultCliToolProfileId || undefined,
      executionMode: implementAgent.defaultExecutionMode
    });
    const runCard = workspaceForRun.cards.find((item) => item.id === cardId) ?? card;
    const profile = workspaceForRun.cliToolProfiles.find(
      (item) => item.id === (runCard.cliToolProfileId || workspaceForRun.defaultCliToolProfileId)
    );
    if (!profile) {
      setWarning("Select a CLI profile before running Claude Code / Codex.");
      return;
    }

    const started = startCliExecution(workspaceForRun, cardId, retryMode);
    setWarning(started.warning ?? null);
    if (started.warning) {
      setState((current) => ({
        ...current,
        workspaces: current.workspaces.map((workspace) =>
          workspace.id === current.activeWorkspaceId ? started.workspace : workspace
        )
      }));
      return;
    }
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? started.workspace : workspace
      )
    }));

    const runningCard = started.workspace.cards.find((item) => item.id === cardId) ?? card;
    const result = await runCliAgent(started.workspace, runningCard, profile, (message, usage) => {
      setState((current) => ({
        ...current,
        workspaces: current.workspaces.map((workspace) => {
          if (workspace.id !== current.activeWorkspaceId) {
            return workspace;
          }
          const withUsage = usage ? updateActiveSessionUsage(workspace, cardId, usage) : workspace;
          return message ? appendCardLog(withUsage, cardId, message) : withUsage;
        })
      }));
    }).catch((error: unknown) => ({
      ok: false,
      provider: profile.name,
      summary: "CLI agent execution failed.",
      rawText: error instanceof Error ? error.message : "Unknown CLI execution error.",
      resolvedExecutablePath: undefined,
      executionLogs: []
    }));

    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId
          ? workspace.cards.find((item) => item.id === cardId)?.columnId === "in-process"
            ? result.resolvedExecutablePath
              ? updateCliToolProfile(completeCliExecution(workspace, cardId, result), profile.id, {
                  resolvedExecutablePath: result.resolvedExecutablePath
                })
              : completeCliExecution(workspace, cardId, result)
            : workspace
          : workspace
      )
    }));
  };

  const confirmAction = (message: string): boolean => window.confirm(message);

  const isGeneratingPlanCard = (card: KanbanCard | undefined): card is KanbanCard =>
    Boolean(card && card.columnId === "my-plan" && card.locked);

  const handleSelectCard = (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (isGeneratingPlanCard(card)) {
      setWarning("This plan is still generating. Cancel it first or wait until it finishes before opening.");
      return;
    }
    setSelectedCardId(cardId);
  };

  const markPlanGenerationCancelled = (cardId: string) => {
    updateActiveWorkspace((workspace) =>
      appendCardLog(
        updateCard(workspace, cardId, {
          description: "Plan generation cancelled by user.",
          locked: false
        }),
        cardId,
        "Plan generation cancelled",
        "warning"
      )
    );
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
    }
    setWarning("Plan generation cancelled.");
  };

  const stopPlanGeneration = async (card: KanbanCard) => {
    cancelledPlanIdsRef.current.add(card.id);
    planAbortControllersRef.current.get(card.id)?.abort();
    planAbortControllersRef.current.delete(card.id);
    if (card.runnerType === "cli") {
      await cliBridge.cancel(card.id);
    }
  };

  const handleCancelPlanGenerating = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!isGeneratingPlanCard(card)) {
      return;
    }
    if (!confirmAction("Cancel this plan generation and stop the AI process?")) {
      return;
    }

    await stopPlanGeneration(card);
    markPlanGenerationCancelled(card.id);
  };

  const handleReviewAction = (
    cardId: string,
    action: "approve" | "request-changes" | "retry" | "rollback"
  ) => {
    const confirmMessages = {
      approve: "Approve this session?",
      "request-changes": "Reject this session and send it back to My Plan?",
      retry: "Retry this session?",
      rollback: "Rollback this session?"
    };

    if (!confirmAction(confirmMessages[action])) {
      return;
    }

    updateActiveWorkspace((workspace) => applyReviewAction(workspace, cardId, action));
  };

  const handleStartCard = (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    const implementAgent = resolveImplementAgentForCard(card, activeWorkspace, selectedImplementColumnAgentId);
    if (!implementAgent) {
      setWarning("No Implement Agent is configured. Please set up an Implement Agent first.");
      return;
    }

    if (implementAgent.defaultRunnerType === "cli") {
      void handleRunCliAgent(cardId);
      return;
    }

    void handleRunPlanOnly(cardId);
  };

  const handleSendToImplement = (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    const implementAgent = resolveImplementAgentForCard(card, activeWorkspace, selectedImplementColumnAgentId);
    if (!implementAgent) {
      setWarning("No Implement Agent is configured. Please set up an Implement Agent first.");
      return;
    }
    const workspaceWithAgent = updateCard(activeWorkspace, cardId, {
      implementAgentProfileId: implementAgent.id
    });
    const result = moveCard(workspaceWithAgent, cardId, "start-implement");
    setWarning(result.warning ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? result.workspace : workspace
      )
    }));
  };

  const handleBackToPlan = (cardId: string) => {
    const result = moveCard(activeWorkspace, cardId, "my-plan");
    setWarning(result.warning ?? null);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId ? result.workspace : workspace
      )
    }));
  };

  const runImplementationFromWorkspace = async (workspace: Workspace, cardId: string): Promise<Workspace> => {
    const card = workspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return workspace;
    }
    const implementAgent = resolveImplementAgentForCard(card, workspace, selectedImplementColumnAgentId);
    if (!implementAgent) {
      setWarning("No Implement Agent is configured. Please set up an Implement Agent first.");
      return appendCardLog(workspace, cardId, "Queued implementation skipped: no Implement Agent configured", "warning");
    }
    const workspaceForRun = updateCard(workspace, cardId, {
      agentProfileId: implementAgent.id,
      implementAgentProfileId: implementAgent.id,
      skillIds: implementAgent.skillIds,
      runnerType: implementAgent.defaultRunnerType,
      modelProfileId: implementAgent.defaultModelProfileId || workspace.defaultModelProfileId,
      cliToolProfileId: implementAgent.defaultCliToolProfileId || workspace.defaultCliToolProfileId || undefined,
      executionMode: implementAgent.defaultExecutionMode
    });
    const runCard = workspaceForRun.cards.find((item) => item.id === cardId) ?? card;

    if (implementAgent.defaultRunnerType === "api") {
      const started = startPlanOnlyExecution(workspaceForRun, cardId, "fresh");
      setWarning(started.warning ?? null);
      if (started.warning) {
        return started.workspace;
      }

      let runningWorkspace = started.workspace;
      setState((current) => ({
        ...current,
        workspaces: current.workspaces.map((item) =>
          item.id === current.activeWorkspaceId ? runningWorkspace : item
        )
      }));

      const runningCard = runningWorkspace.cards.find((item) => item.id === cardId) ?? runCard;
      const result = await runPlanOnly(runningWorkspace, runningCard, (message) => {
        runningWorkspace = appendCardLog(runningWorkspace, cardId, message);
        setState((current) => ({
          ...current,
          workspaces: current.workspaces.map((item) =>
            item.id === current.activeWorkspaceId ? runningWorkspace : item
          )
        }));
      }).catch((error: unknown) => ({
        provider: "runner",
        summary: "Plan Only execution failed.",
        rawText: error instanceof Error ? error.message : "Unknown Plan Only execution error."
      }));

      return completePlanOnlyExecution(runningWorkspace, cardId, result);
    }

    const profile = workspaceForRun.cliToolProfiles.find(
      (item) => item.id === (runCard.cliToolProfileId || workspaceForRun.defaultCliToolProfileId)
    );
    if (!profile) {
      setWarning(`Select a CLI profile before running ${card.title}.`);
      return appendCardLog(workspace, cardId, "Queued implementation skipped: no CLI profile selected", "warning");
    }

    const started = startCliExecution(workspaceForRun, cardId, "fresh");
    setWarning(started.warning ?? null);
    if (started.warning) {
      return started.workspace;
    }

    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) =>
        item.id === current.activeWorkspaceId ? started.workspace : item
      )
    }));

    const runningCard = started.workspace.cards.find((item) => item.id === cardId) ?? runCard;
    const result = await runCliAgent(started.workspace, runningCard, profile, (message, usage) => {
      setState((current) => ({
        ...current,
        workspaces: current.workspaces.map((item) => {
          if (item.id !== current.activeWorkspaceId) {
            return item;
          }
          const withUsage = usage ? updateActiveSessionUsage(item, cardId, usage) : item;
          return message ? appendCardLog(withUsage, cardId, message) : withUsage;
        })
      }));
    }).catch((error: unknown) => ({
      ok: false,
      provider: profile.name,
      summary: "CLI agent execution failed.",
      rawText: error instanceof Error ? error.message : "Unknown CLI execution error.",
      resolvedExecutablePath: undefined,
      executionLogs: []
    }));

    return started.workspace.cards.find((item) => item.id === cardId)?.columnId === "in-process"
      ? result.resolvedExecutablePath
        ? updateCliToolProfile(completeCliExecution(started.workspace, cardId, result), profile.id, {
            resolvedExecutablePath: result.resolvedExecutablePath
          })
        : completeCliExecution(started.workspace, cardId, result)
      : started.workspace;
  };

  const handleCancelExecution = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (isGeneratingPlanCard(card)) {
      await handleCancelPlanGenerating(cardId);
      return;
    }

    if (!confirmAction("Cancel this running session?")) {
      return;
    }

    await cliBridge.cancel(cardId);
    updateActiveWorkspace((workspace) => cancelExecution(workspace, cardId));
  };

  const handleTestCliTool = async (profile: CliToolProfile): Promise<CliValidationResult> => {
    const result = await cliBridge.test({
      args: profile.args,
      command: profile.command,
      cwd: profile.workingDirectory || activeWorkspace.repoPath || "",
      environmentVariables: profile.environmentVariables,
      resolvedExecutablePath: profile.resolvedExecutablePath,
      timeoutSeconds: Math.min(profile.timeoutSeconds, 120)
    });

    setWarning(result.ok ? result.message : result.stderr || result.message);
    if (result.ok && result.resolvedExecutablePath) {
      updateActiveWorkspace((workspace) =>
        updateCliToolProfile(workspace, profile.id, {
          resolvedExecutablePath: result.resolvedExecutablePath,
          detectedVersion: result.version
        })
      );
    }
    return result;
  };

  const handleStartImplementAll = async () => {
    let queueWorkspace = activeWorkspace;
    const queuedCardIds = queueWorkspace.cards
      .filter((card) => card.columnId === "start-implement" && !card.locked)
      .map((card) => card.id);

    if (queuedCardIds.length === 0) {
      setWarning("No cards are queued in Start Implement.");
      return;
    }

    setWarning(`Starting ${queuedCardIds.length} queued implementation task${queuedCardIds.length > 1 ? "s" : ""}.`);
    for (const cardId of queuedCardIds) {
      queueWorkspace = await runImplementationFromWorkspace(queueWorkspace, cardId);
      setState((current) => ({
        ...current,
        workspaces: current.workspaces.map((workspace) =>
          workspace.id === current.activeWorkspaceId ? queueWorkspace : workspace
        )
      }));
    }
    setWarning("Start Implement queue completed.");
  };

  const handleDeleteCard = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!confirmAction(`Delete "${card?.title ?? "this card"}"?`)) {
      return;
    }

    if (isGeneratingPlanCard(card)) {
      await stopPlanGeneration(card);
    }

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

    const latestSession = card.sessions.find((session) => session.id === card.activeSessionId) ?? card.sessions.at(-1);
    const patchText = extractPatchForApply([card.patchText, latestSession?.diffText, card.diffPlaceholder]);
    if (!patchText.trim()) {
      setWarning("No valid patch was found on this card. Ask the agent to generate a unified diff, or paste one into the Diff/Patch field.");
      return;
    }

    const result = await repoBridge.applyPatch({
      allowedEditableFolders: activeWorkspace.allowedEditableFolders,
      blockedFilePatterns: activeWorkspace.blockedFilePatterns,
      patchText,
      repoPath: card.projectContext.repoPath || activeWorkspace.repoPath,
      versionControlProvider:
        activeWorkspace.repoInspection?.versionControlProvider === "plastic" || activeWorkspace.versionControlProvider === "plastic"
          ? "plastic"
          : "git"
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

    const provider = activeWorkspace.repoInspection?.versionControlProvider;
    if (provider !== "git" && provider !== "plastic") {
      setWarning("Inspect a Git repository or Plastic workspace before committing.");
      return;
    }

    const message = card.commitMessage || card.title;
    const result = await repoBridge.commitChanges({
      message,
      repoPath: card.projectContext.repoPath || activeWorkspace.repoPath,
      versionControlProvider: provider
    });
    setWarning(result.ok ? null : result.output);
    updateActiveWorkspace((workspace) => recordCommandResult(workspace, cardId, "commit", result));
  };

  const handleRollbackFiles = async (cardId: string) => {
    const card = activeWorkspace.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    const provider = activeWorkspace.repoInspection?.versionControlProvider;
    if (provider !== "git" && provider !== "plastic") {
      setWarning("Inspect a Git repository or Plastic workspace before rolling back files.");
      return;
    }

    const files = card.projectContext.targetFiles || card.projectContext.targetPaths;
    const result = await repoBridge.rollbackFiles({
      files,
      repoPath: card.projectContext.repoPath || activeWorkspace.repoPath,
      versionControlProvider: provider
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
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="app-body">
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
            <option value="start-implement">Start Implement</option>
            <option value="in-process">In Process</option>
            <option value="in-review">In Review</option>
            <option value="done">Done</option>
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
          onOpenSettings={() => setSettingsOpen(true)}
          onApplyPatch={handleApplyPatch}
          onCancelCard={handleCancelExecution}
          onSelectCard={handleSelectCard}
          onCreateCard={handleCreateCard}
          onColumnAgentChange={handleColumnAgentChange}
          onMoveCard={handleMoveCard}
          onReorderCard={handleReorderCard}
          onReviewAction={handleReviewAction}
          onStartCard={handleStartCard}
          onStartImplementAll={handleStartImplementAll}
        />
        </main>

      </div>

      <CardDetailModal
        card={selectedCard}
        workspace={activeWorkspace}
        onClose={() => setSelectedCardId(null)}
        onUpdateCard={(cardId: string, updates: Partial<KanbanCard>) =>
          updateActiveWorkspace((workspace) => updateCard(workspace, cardId, updates))
        }
        onDeleteCard={handleDeleteCard}
        onDuplicateCard={handleDuplicateCard}
        onSendToImplement={handleSendToImplement}
        onBackToPlan={handleBackToPlan}
        onReviewAction={handleReviewAction}
        onSimulateExecution={(cardId) =>
          updateActiveWorkspace((workspace) => {
            const result = simulateExecution(workspace, cardId);
            setWarning(result.warning ?? null);
            return result.workspace;
          })
        }
        onCancelExecution={handleCancelExecution}
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

      {planPromptOpen ? (
        <PlanPromptModal
          isGenerating={false}
          workspace={activeWorkspace}
          onClose={() => setPlanPromptOpen(false)}
          onManualSubmit={handleCreateManualPlan}
          onSubmit={handleCreatePlanFromPrompt}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          activeWorkspace={activeWorkspace}
          state={state}
          themeMode={themeMode}
          onClose={() => setSettingsOpen(false)}
          onCreateAgent={() => updateActiveWorkspace(createAgentProfile)}
          onCreateCliTool={() => updateActiveWorkspace(createCliToolProfile)}
          onCreateModel={() => updateActiveWorkspace(createModelProfile)}
          onCreateSkill={() => updateActiveWorkspace(createSkill)}
          onCreateWorkspace={handleCreateWorkspace}
          onDeleteAgent={(agentId) => updateActiveWorkspace((workspace) => deleteAgentProfile(workspace, agentId))}
          onDeleteCliTool={(profileId) => updateActiveWorkspace((workspace) => deleteCliToolProfile(workspace, profileId))}
          onDeleteModel={(modelId) => updateActiveWorkspace((workspace) => deleteModelProfile(workspace, modelId))}
          onDeleteSkill={(skillId) => updateActiveWorkspace((workspace) => deleteSkill(workspace, skillId))}
          onDeleteWorkspace={handleDeleteWorkspace}
          onDuplicateSkill={(skillId) => updateActiveWorkspace((workspace) => duplicateSkill(workspace, skillId))}
          onInspectRepo={handleInspectRepo}
          onReset={() => {
            setState(resetAppState());
            setSelectedCardId(null);
          }}
          onSelectRepoFolder={handleSelectRepoFolder}
          onSwitchBranch={handleSwitchBranch}
          onSelectWorkspace={(workspaceId) => {
            setState((current) => ({ ...current, activeWorkspaceId: workspaceId }));
            setSelectedCardId(null);
          }}
          onThemeChange={setThemeMode}
          onTestCliTool={handleTestCliTool}
          onUpdateAgent={(agentId, updates) =>
            updateActiveWorkspace((workspace) => updateAgentProfile(workspace, agentId, updates))
          }
          onUpdateCliTool={(profileId, updates) =>
            updateActiveWorkspace((workspace) => updateCliToolProfile(workspace, profileId, updates))
          }
          onUpdateModel={(modelId, updates) =>
            updateActiveWorkspace((workspace) => updateModelProfile(workspace, modelId, updates))
          }
          onUpdateSkill={(skillId, updates) => updateActiveWorkspace((workspace) => updateSkill(workspace, skillId, updates))}
          onUpdateWorkspace={(updates) => {
            updateActiveWorkspace((workspace) => ({ ...workspace, ...updates, updatedAt: nowIso() }));
          }}
        />
      ) : null}
    </div>
  );
};

const extractPatchForApply = (values: Array<string | undefined>): string => {
  for (const value of values) {
    const text = value?.trim();
    if (!text) {
      continue;
    }

    const fencedBlocks = [...text.matchAll(/```(?:diff|patch)?\s*([\s\S]*?)```/gi)].map((match) => match[1]?.trim() ?? "");
    for (const candidate of [...fencedBlocks, text]) {
      const patch = extractPatchCandidate(candidate);
      if (patch) {
        return patch;
      }
    }
  }

  return "";
};

const extractPatchCandidate = (value: string): string => {
  const lines = value.split(/\r?\n/);
  const firstPatchLine = lines.findIndex((line) =>
    line.startsWith("diff --git ") ||
    line.startsWith("--- ") ||
    line.startsWith("Index: ")
  );

  if (firstPatchLine < 0) {
    return "";
  }

  const patch = sanitizePatchLines(lines.slice(firstPatchLine)).join("\n").trim();
  const hasFileHeader = /(?:^|\n)(diff --git |Index: |--- )/.test(patch) && /(?:^|\n)\+\+\+ /.test(patch);
  const hasHunk = /(?:^|\n)@@ /.test(patch);
  return hasFileHeader && hasHunk ? `${patch}\n` : "";
};

const sanitizePatchLines = (lines: string[]): string[] => {
  const patchLines: string[] = [];
  let inHunk = false;
  let oldTarget = 0;
  let newTarget = 0;
  let oldCount = 0;
  let newCount = 0;

  const finishHunkIfComplete = () => {
    if (inHunk && oldCount >= oldTarget && newCount >= newTarget) {
      inHunk = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      break;
    }

    if (isPatchHeaderLine(line)) {
      inHunk = false;
      patchLines.push(line);
      continue;
    }

    if (line.startsWith("@@ ")) {
      const counts = parseHunkCounts(line);
      inHunk = true;
      oldTarget = counts.oldCount;
      newTarget = counts.newCount;
      oldCount = 0;
      newCount = 0;
      patchLines.push(line);
      continue;
    }

    if (!inHunk) {
      if (line.trim() === "") {
        continue;
      }
      break;
    }

    const normalizedLine = line === "" ? " " : /^[ +\-\\]/.test(line) ? line : ` ${line}`;
    if (normalizedLine.startsWith("\\ ")) {
      patchLines.push(normalizedLine);
      continue;
    }
    if (!normalizedLine.startsWith("+")) {
      oldCount += 1;
    }
    if (!normalizedLine.startsWith("-")) {
      newCount += 1;
    }
    patchLines.push(normalizedLine);
    finishHunkIfComplete();
  }

  return patchLines;
};

const isPatchHeaderLine = (line: string): boolean =>
  line.startsWith("diff --git ") ||
  line.startsWith("Index: ") ||
  line.startsWith("====") ||
  line.startsWith("index ") ||
  line.startsWith("--- ") ||
  line.startsWith("+++ ") ||
  line.startsWith("new file mode ") ||
  line.startsWith("deleted file mode ") ||
  line.startsWith("old mode ") ||
  line.startsWith("new mode ") ||
  line.startsWith("similarity index ") ||
  line.startsWith("rename from ") ||
  line.startsWith("rename to ") ||
  line.startsWith("copy from ") ||
  line.startsWith("copy to ");

const parseHunkCounts = (line: string): { oldCount: number; newCount: number } => {
  const match = line.match(/^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/);
  return {
    oldCount: Number.parseInt(match?.[1] ?? "1", 10),
    newCount: Number.parseInt(match?.[2] ?? "1", 10)
  };
};
