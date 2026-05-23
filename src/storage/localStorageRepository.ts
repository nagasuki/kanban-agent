import { createSeedState } from "../data/seed";
import { createDefaultCliToolProfiles, createDefaultProjectContext } from "../domain/defaults";
import type { AppState } from "../domain/types";

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
      defaultBranch: workspace.defaultBranch ?? "main",
      defaultCliToolProfileId: workspace.defaultCliToolProfileId || cliToolProfiles[0]?.id || "",
      allowedEditableFolders: workspace.allowedEditableFolders ?? "",
      blockedFilePatterns: workspace.blockedFilePatterns ?? ".env, *.pem, *.key",
      testCommand: workspace.testCommand ?? "",
      buildCommand: workspace.buildCommand ?? "",
      repoInspection: workspace.repoInspection,
      skills: workspace.skills.map((skill) => ({
        ...skill,
        version: skill.version ?? "0.1.0"
      })),
      cliToolProfiles,
      agentProfiles: workspace.agentProfiles.map((agent) => ({
        ...agent,
        defaultExecutionMode: agent.defaultExecutionMode ?? "Suggest Patch"
      })),
      cards: workspace.cards.map((card) => ({
        ...card,
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
          ...card.safetySettings,
          requireApprovalBeforePr: card.safetySettings.requireApprovalBeforePr ?? true
        },
        projectContext: {
          ...createDefaultProjectContext(workspace.repoPath),
          ...card.projectContext
        }
      }))
    };
  })
});
