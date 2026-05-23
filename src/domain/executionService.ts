import { createLogEntry } from "./defaults";
import type { CliToolProfile, KanbanCard, ModelProfile, SkillPreset } from "./types";

export const buildExecutionPreview = (
  card: KanbanCard,
  model: ModelProfile | undefined,
  skills: SkillPreset[],
  cliTool?: CliToolProfile | undefined
): string => {
  const skillNames = skills.length > 0 ? skills.map((skill) => skill.name).join(", ") : "No skill selected";
  return [
    `Runner: ${card.runnerType === "cli" ? "CLI" : "API Model"}`,
    `API model: ${model?.modelName ?? "No API model selected"}`,
    `API provider: ${model?.provider ?? "Unknown"}`,
    `CLI tool: ${cliTool?.name ?? "No CLI selected"}`,
    `CLI command: ${cliTool?.command ?? "Not set"}`,
    `Skill: ${skillNames}`,
    `Execution mode: ${card.executionMode}`,
    `Repo: ${card.projectContext.repoPath || "Not set"}`,
    `Targets: ${card.projectContext.targetPaths || "Not set"}`,
    `Target files: ${card.projectContext.targetFiles || "Not set"}`,
    `Target folders: ${card.projectContext.targetFolders || "Not set"}`,
    `Related issue: ${card.projectContext.relatedIssueLink || "Not set"}`,
    `Safety: preview diff ${card.safetySettings.previewDiffBeforeApply ? "on" : "off"}, block secrets ${
      card.safetySettings.blockedSecretFiles ? "on" : "off"
    }, approve PR ${card.safetySettings.requireApprovalBeforePr ? "on" : "off"}`,
    "",
    "Final generated prompt preview:",
    "",
    card.description
  ].join("\n");
};

export const createImplementationLogBurst = () => [
  createLogEntry("Task started"),
  createLogEntry("Reading plan"),
  createLogEntry("Applying selected skill"),
  createLogEntry("Generating implementation steps"),
  createLogEntry("Waiting for review")
];
