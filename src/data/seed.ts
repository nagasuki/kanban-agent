import {
  createDefaultProjectContext,
  createDefaultCliToolProfiles,
  createDefaultReviewChecklist,
  createDefaultSafetySettings,
  createLogEntry
} from "../domain/defaults";
import { createId, nowIso } from "../domain/id";
import type { AppState, KanbanCard, ModelProfile, SkillPreset, Workspace } from "../domain/types";

export const createSeedState = (): AppState => {
  const timestamp = nowIso();
  const workspaceId = createId("workspace");

  const skills: SkillPreset[] = [
    {
      id: createId("skill"),
      name: "Code Reviewer",
      version: "1.0.0",
      description: "Finds bugs, regressions, and missing tests before merge.",
      markdown: "# Code Reviewer\n\nPrioritize correctness, security, regressions, and test gaps. Lead with actionable findings.",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: createId("skill"),
      name: "Bug Fix Agent",
      version: "1.0.0",
      description: "Diagnoses failures and implements focused fixes.",
      markdown: "# Bug Fix Agent\n\nReproduce the issue, isolate the cause, patch narrowly, and verify with relevant tests.",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: createId("skill"),
      name: "Documentation Writer",
      version: "1.0.0",
      description: "Turns implementation detail into concise user-facing docs.",
      markdown: "# Documentation Writer\n\nExplain workflows clearly, keep examples runnable, and avoid unexplained jargon.",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: createId("skill"),
      name: "Unity Programmer",
      version: "1.0.0",
      description: "Implements gameplay systems with Unity and C#.",
      markdown:
        "# Unity Programmer\n\nPrefer clear MonoBehaviour boundaries, deterministic gameplay logic, and editor-friendly configuration.",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: createId("skill"),
      name: "Refactor Agent",
      version: "1.0.0",
      description: "Improves structure while preserving behavior.",
      markdown:
        "# Refactor Agent\n\nKeep public behavior stable, reduce duplication, and verify risky paths with tests or focused checks.",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: createId("skill"),
      name: "TypeScript App Developer",
      version: "1.0.0",
      description: "Builds strict TypeScript app features with clean component boundaries.",
      markdown:
        "# TypeScript App Developer\n\nUse strict types, keep domain logic outside UI components, and match the existing app architecture.",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  const models: ModelProfile[] = [
    {
      id: createId("model"),
      name: "Default OpenAI Planner",
      provider: "OpenAI",
      modelName: "gpt-5",
      apiKeyPlaceholder: "OPENAI_API_KEY",
      baseUrlPlaceholder: "https://api.openai.com/v1",
      temperature: 0.2,
      maxTokens: 8192,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: createId("model"),
      name: "Local Dry Run",
      provider: "Local",
      modelName: "local-agent-sim",
      apiKeyPlaceholder: "not required",
      baseUrlPlaceholder: "http://localhost:11434",
      temperature: 0.1,
      maxTokens: 4096,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  const agentProfileId = createId("agent");
  const cliProfiles = createDefaultCliToolProfiles();
  const cards: KanbanCard[] = [
    createSeedCard({
      workspaceId,
      columnId: "my-plan",
      title: "Build execution preview panel",
      description: "When a plan enters Start Implement, show selected model, selected skill, repo context, and execution mode.",
      skillIds: [skills[1].id],
      modelProfileId: models[0].id,
      repoPath: "D:\\kanban-agent",
      targetPaths: "src/domain, src/components/drawer"
    }),
    createSeedCard({
      workspaceId,
      columnId: "skill-used",
      title: "Prepare review workflow",
      description: "Attach Code Reviewer and configure checklist state before moving cards into In Review.",
      skillIds: [skills[0].id],
      modelProfileId: models[0].id,
      repoPath: "D:\\kanban-agent",
      targetPaths: "src/components/cards, src/domain/boardService.ts"
    }),
    createSeedCard({
      workspaceId,
      columnId: "in-review",
      title: "Document safety settings",
      description: "Summarize sandbox settings and explain how approvals will work before real API execution exists.",
      skillIds: [skills[2].id],
      modelProfileId: models[1].id,
      repoPath: "D:\\kanban-agent",
      targetPaths: "README.md"
    })
  ];

  const workspace: Workspace = {
    id: workspaceId,
    name: "kanban-agent",
    repoPath: "D:\\kanban-agent",
    defaultBranch: "main",
    defaultModelProfileId: models[0].id,
    defaultAgentProfileId: agentProfileId,
    defaultCliToolProfileId: cliProfiles[0].id,
    allowedEditableFolders: "src, electron, docs",
    blockedFilePatterns: ".env, *.pem, *.key, secrets.*",
    testCommand: "npm run typecheck",
    buildCommand: "npm run build",
    cards,
    skills,
    modelProfiles: models,
    cliToolProfiles: cliProfiles,
    agentProfiles: [
      {
        id: agentProfileId,
        name: "Implementation Agent",
        skillIds: [skills[1].id],
        defaultModelProfileId: models[0].id,
        defaultExecutionMode: "Suggest Patch",
        notes: "Default profile for focused implementation tasks.",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    activeWorkspaceId: workspaceId,
    workspaces: [workspace]
  };
};

const createSeedCard = (input: {
  workspaceId: string;
  columnId: KanbanCard["columnId"];
  title: string;
  description: string;
  skillIds: string[];
  modelProfileId: string;
  repoPath: string;
  targetPaths: string;
}): KanbanCard => {
  const timestamp = nowIso();
  return {
    id: createId("card"),
    workspaceId: input.workspaceId,
    columnId: input.columnId,
    title: input.title,
    description: input.description,
    skillIds: input.skillIds,
    modelProfileId: input.modelProfileId,
    agentProfileId: undefined,
    cliToolProfileId: undefined,
    executionMode: "Suggest Patch",
    projectContext: {
      ...createDefaultProjectContext(input.repoPath),
      targetPaths: input.targetPaths,
      targetFolders: input.targetPaths,
      notes: "Seed project context for local prototype testing."
    },
    safetySettings: createDefaultSafetySettings(),
    reviewChecklist: {
      ...createDefaultReviewChecklist(),
      scopeMatchesPlan: input.columnId === "in-review",
      summaryIsClear: input.columnId === "in-review"
    },
    activityLog: [createLogEntry("Seed card created")],
    resultSummary: input.columnId === "in-review" ? "Simulated docs update is ready for review." : "",
    diffPlaceholder: input.columnId === "in-review" ? "Diff placeholder: README.md would be updated." : "",
    patchText: "",
    testOutput: "",
    buildOutput: "",
    applyOutput: "",
    commitMessage: "",
    prTitle: "",
    prDescription: "",
    prUrl: "",
    locked: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};
