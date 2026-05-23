import type { ModelProviderClient } from "./modelProvider";
import { anthropicProvider } from "./anthropicProvider";
import { customProvider } from "./customProvider";
import { googleProvider } from "./googleProvider";
import { localProvider } from "./localProvider";
import { openAiProvider } from "./openAiProvider";
import type { ModelProvider, ModelProfile } from "../../domain/types";

const providers: Record<ModelProvider, ModelProviderClient> = {
  OpenAI: openAiProvider,
  Anthropic: anthropicProvider,
  Google: googleProvider,
  Local: localProvider,
  "Custom API": customProvider
};

export const getModelProviderClient = (provider: ModelProvider): ModelProviderClient => providers[provider];

export const testModelConnection = (model: ModelProfile, apiKey?: string | null) =>
  getModelProviderClient(model.provider).testConnection(model, apiKey);
