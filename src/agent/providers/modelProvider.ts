import type { GeneratedPrompt } from "../../domain/promptBuilder";
import type { ModelProfile } from "../../domain/types";

export interface PlanOnlyResult {
  summary: string;
  rawText: string;
  provider: string;
}

export interface ModelProviderClient {
  id: string;
  label: string;
  runPlanOnly: (input: { model: ModelProfile; prompt: GeneratedPrompt }) => Promise<PlanOnlyResult>;
  testConnection: (model: ModelProfile) => Promise<{ ok: boolean; message: string }>;
}

export const createProviderPlaceholder = (label: string): ModelProviderClient => ({
  id: label.toLowerCase().replace(/\s+/g, "-"),
  label,
  runPlanOnly: async ({ model, prompt }) => ({
    provider: label,
    summary: `${label} provider is scaffolded for ${model.modelName}. Real API calls are not enabled until secure key storage is wired.`,
    rawText: [
      `Provider: ${label}`,
      `Model: ${model.modelName}`,
      "",
      "Plan Only dry-run response:",
      "- Read the selected skill markdown.",
      "- Review the workspace and card context.",
      "- Produce an implementation plan without editing files.",
      "",
      "Prompt preview used for this dry run:",
      prompt.finalPromptPreview
    ].join("\n")
  }),
  testConnection: async (model) => {
    if (!model.modelName.trim()) {
      return { ok: false, message: "Model name is required." };
    }

    if (model.provider !== "Local" && !model.baseUrlPlaceholder.trim()) {
      return { ok: false, message: "Base URL placeholder is required for this provider." };
    }

    return {
      ok: true,
      message: `${label} profile is structurally valid. Real network testing is pending secure API key storage.`
    };
  }
});
