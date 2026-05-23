import type { BoardColumn, ExecutionMode, ModelProvider, TaskPriority } from "./types";

export const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: "my-plan",
    title: "My Plan",
    description: "Backlog and task planning"
  },
  {
    id: "start-implement",
    title: "Start Implement",
    description: "Queue and implementation setup"
  },
  {
    id: "in-process",
    title: "In Process",
    description: "Running AI sessions"
  },
  {
    id: "in-review",
    title: "In Review",
    description: "Human approval gate"
  },
  {
    id: "done",
    title: "Done",
    description: "Approved results"
  }
];

export const USER_CREATABLE_COLUMNS = ["my-plan", "start-implement"];

export const USER_MOVABLE_COLUMNS = ["my-plan", "start-implement"];

export const TASK_PRIORITIES: TaskPriority[] = ["Critical", "High", "Normal", "Low"];

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
