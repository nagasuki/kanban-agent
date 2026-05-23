import { createLogEntry } from "./defaults";
import type { KanbanCard, ModelProfile, SkillPreset } from "./types";

export const buildExecutionPreview = (
  card: KanbanCard,
  model: ModelProfile | undefined,
  skills: SkillPreset[]
): string => {
  const skillNames = skills.length > 0 ? skills.map((skill) => skill.name).join(", ") : "No skill selected";
  return [
    `Model: ${model?.modelName ?? "No model selected"}`,
    `Provider: ${model?.provider ?? "Unknown"}`,
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
