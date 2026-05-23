import type { AgentProfile, KanbanCard, ModelProfile, SkillPreset, Workspace } from "./types";

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
  agent: AgentProfile | undefined
): GeneratedPrompt => {
  const skillMarkdown = skills.length > 0 ? skills.map(formatSkillMarkdown).join("\n\n") : "No skill preset selected.";
  const safetyInstructions = buildSafetyInstructions(card, workspace);

  const systemPrompt = [
    "You are an implementation planning agent controlled by kanban-agent.",
    "The user remains in control. Do not edit files, run commands, commit, or open pull requests unless the execution mode explicitly allows it and the user has approved the action.",
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
    `Model: ${model ? `${model.provider} / ${model.modelName}` : "Not set"}`,
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
