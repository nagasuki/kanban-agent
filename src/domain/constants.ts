import type { BoardColumn, ExecutionMode, ModelProvider } from "./types";

export const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: "my-skill",
    title: "My Skill",
    description: "Reusable skill.md presets"
  },
  {
    id: "my-plan",
    title: "My Plan",
    description: "Implementation plans"
  },
  {
    id: "skill-used",
    title: "Skill Used",
    description: "Prepared agent context"
  },
  {
    id: "start-implement",
    title: "Start Implement",
    description: "Execution preview"
  },
  {
    id: "in-process",
    title: "In Process",
    description: "Running tasks"
  },
  {
    id: "in-review",
    title: "In Review",
    description: "Review and approve"
  },
  {
    id: "successfully",
    title: "Successfully",
    description: "Approved work"
  }
];

export const EXECUTION_MODES: ExecutionMode[] = [
  "Plan Only",
  "Suggest Patch",
  "Apply Patch",
  "Apply + Run Test",
  "Apply + Commit",
  "Apply + PR"
];

export const MODEL_PROVIDERS: ModelProvider[] = [
  "OpenAI",
  "Anthropic",
  "Google",
  "Local",
  "Custom API"
];
