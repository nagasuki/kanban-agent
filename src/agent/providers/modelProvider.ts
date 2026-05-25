import type { GeneratedPrompt } from "../../domain/promptBuilder";
import type { ModelProfile, ProviderUsageRecord } from "../../domain/types";

export interface PlanOnlyResult {
  summary: string;
  rawText: string;
  provider: string;
  usageRecord?: ProviderUsageRecord;
}

export interface ModelProviderClient {
  id: string;
  label: string;
  runPlanOnly: (input: {
    apiKey: string | null;
    model: ModelProfile;
    onStream?: (message: string) => void;
    prompt: GeneratedPrompt;
  }) => Promise<PlanOnlyResult>;
  testConnection: (model: ModelProfile, apiKey?: string | null) => Promise<{ ok: boolean; message: string }>;
}

export const createProviderPlaceholder = (label: string): ModelProviderClient => ({
  id: label.toLowerCase().replace(/\s+/g, "-"),
  label,
  runPlanOnly: async ({ model, onStream, prompt }) => {
    onStream?.(`${label} placeholder provider received the generated prompt.`);
    onStream?.(`${label} placeholder provider produced a dry-run Plan Only response.`);

    return {
      provider: label,
      summary: `${label} provider is scaffolded for ${model.modelName}. Real API calls are pending provider-specific implementation.`,
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
    };
  },
  testConnection: async (model, apiKey) => {
    if (!model.modelName.trim()) {
      return { ok: false, message: "Model name is required." };
    }

    if (model.provider !== "Local" && !model.baseUrlPlaceholder.trim()) {
      return { ok: false, message: "Base URL placeholder is required for this provider." };
    }

    if (model.provider !== "Local" && !apiKey) {
      return { ok: false, message: "No secure API key is stored for this model profile." };
    }

    return {
      ok: true,
      message: `${label} profile is structurally valid. Real network testing is pending secure API key storage.`
    };
  }
});
