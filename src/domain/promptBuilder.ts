import type { AgentProfile, CliToolProfile, KanbanCard, ModelProfile, SkillPreset, Workspace } from "./types";

export interface GeneratedPrompt {
  systemPrompt: string;
  userPrompt: string;
  finalPromptPreview: string;
}

export const buildAgentPrompt = (
  card: KanbanCard,
  workspace: Workspace,
  model: ModelProfile | undefined,
  skills: SkillPreset[],
  agent: AgentProfile | undefined,
  cliTool?: CliToolProfile | undefined
): GeneratedPrompt => {
  const skillMarkdown = skills.length > 0 ? skills.map(formatSkillMarkdown).join("\n\n") : "No skill preset selected.";
  const safetyInstructions = buildSafetyInstructions(card, workspace);
  const agentRole = card.columnId === "my-plan" || card.executionMode === "Plan Only" ? "planning" : "implementation";

  const systemPrompt = [
    `You are a ${agentRole} agent controlled by kanban-agent.`,
    agentRole === "planning"
      ? "Plan Mode only: do not edit files, apply patches, run implementation commands, commit, or open pull requests."
      : "Implementation Mode: make only the requested changes, produce reviewable diff output, and respect all approval gates.",
    "The user remains in control. Do not commit or open pull requests unless the execution mode explicitly allows it and the user has approved the action.",
    agent ? `Agent profile: ${agent.name}` : "Agent profile: none selected",
    agent?.notes ? `Agent notes: ${agent.notes}` : "",
    "",
    "Selected skill markdown:",
    skillMarkdown,
    "",
    "Safety instructions:",
    safetyInstructions
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    `Workspace: ${workspace.name}`,
    `Repo path: ${card.projectContext.repoPath || workspace.repoPath || "Not set"}`,
    `Default branch: ${workspace.defaultBranch || "Not set"}`,
    `Runner: ${card.runnerType === "cli" ? "CLI" : "API Model"}`,
    `API model: ${model ? `${model.provider} / ${model.modelName}` : "Not set"}`,
    `CLI tool: ${cliTool ? `${cliTool.provider} / ${cliTool.name}` : "Not set"}`,
    `Execution mode: ${card.executionMode}`,
    `Target paths: ${card.projectContext.targetPaths || "Not set"}`,
    `Target files: ${card.projectContext.targetFiles || "Not set"}`,
    `Target folders: ${card.projectContext.targetFolders || "Not set"}`,
    `Related documents: ${card.projectContext.relatedDocuments || "Not set"}`,
    `Related issue: ${card.projectContext.relatedIssueLink || "Not set"}`,
    `Test command: ${workspace.testCommand || "Not set"}`,
    `Build command: ${workspace.buildCommand || "Not set"}`,
    "",
    "Plan markdown:",
    card.description || "No plan text provided.",
    "",
    "Extra prompt notes:",
    card.projectContext.extraPromptNotes || "None.",
    "",
    "Attached file context:",
    card.projectContext.attachedFileContext || "No file context attached.",
    "",
    "Project notes:",
    card.projectContext.notes || "None."
  ].join("\n");

  return {
    systemPrompt,
    userPrompt,
    finalPromptPreview: [`# System Prompt`, systemPrompt, "", "# User Prompt", userPrompt].join("\n")
  };
};

export const buildPlanDraftPrompt = (
  card: KanbanCard,
  workspace: Workspace,
  model: ModelProfile | undefined,
  skills: SkillPreset[],
  agent: AgentProfile | undefined,
  cliTool?: CliToolProfile | undefined
): GeneratedPrompt => {
  const basePrompt = buildAgentPrompt(card, workspace, model, skills, agent, cliTool);
  const systemPrompt = [
    basePrompt.systemPrompt,
    "",
    "Plan Mode:",
    "You are only writing the implementation plan for this Kanban card.",
    "Do not edit files, run commands, produce patches, commit, or open pull requests.",
    "Return a clear markdown plan that can be saved directly as the card description.",
    "Include assumptions, target areas, step-by-step implementation approach, validation plan, and review risks."
  ].join("\n");
  const userPrompt = [
    "The user typed a raw requirement. Convert it into a complete implementation plan.",
    "Keep the plan practical and scoped for a coding agent workflow.",
    "",
    basePrompt.userPrompt
  ].join("\n");

  return {
    systemPrompt,
    userPrompt,
    finalPromptPreview: [`# System Prompt`, systemPrompt, "", "# User Prompt", userPrompt].join("\n")
  };
};

const formatSkillMarkdown = (skill: SkillPreset): string =>
  [`## ${skill.name} v${skill.version}`, skill.description, "", skill.markdown].join("\n");

const buildSafetyInstructions = (card: KanbanCard, workspace: Workspace): string => {
  const safety = card.safetySettings;
  return [
    `Preview diff before apply: ${safety.previewDiffBeforeApply ? "required" : "not required"}`,
    `Backup before edit: ${safety.backupBeforeEdit ? "required" : "not required"}`,
    `Restrict editable folders: ${safety.restrictEditableFolders ? "yes" : "no"}`,
    `Allowed editable folders: ${workspace.allowedEditableFolders || "Not configured"}`,
    `Blocked file patterns: ${workspace.blockedFilePatterns || "Not configured"}`,
    `Block .env / secret files: ${safety.blockedSecretFiles ? "yes" : "no"}`,
    `Require approval before commit: ${safety.requireApprovalBeforeCommit ? "yes" : "no"}`,
    `Require approval before PR: ${safety.requireApprovalBeforePr ? "yes" : "no"}`
  ].join("\n");
};
