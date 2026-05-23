import { createId, nowIso } from "./id";
import type { ModelProfile, Workspace } from "./types";

export const createModelProfile = (workspace: Workspace): Workspace => {
  const timestamp = nowIso();
  const model: ModelProfile = {
    id: createId("model"),
    name: "New Model Profile",
    provider: "Custom API",
    modelName: "custom-model",
    apiKeyPlaceholder: "API key placeholder",
    baseUrlPlaceholder: "https://api.example.com/v1",
    temperature: 0.2,
    maxTokens: 4096,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...workspace,
    modelProfiles: [model, ...workspace.modelProfiles],
    updatedAt: timestamp
  };
};

export const updateModelProfile = (
  workspace: Workspace,
  modelId: string,
  updates: Partial<ModelProfile>
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    modelProfiles: workspace.modelProfiles.map((model) =>
      model.id === modelId
        ? {
            ...model,
            ...updates,
            updatedAt: timestamp
          }
        : model
    ),
    updatedAt: timestamp
  };
};

export const deleteModelProfile = (workspace: Workspace, modelId: string): Workspace => {
  const remainingModels = workspace.modelProfiles.filter((model) => model.id !== modelId);
  const fallbackModelId = remainingModels[0]?.id ?? "";

  return {
    ...workspace,
    defaultModelProfileId: workspace.defaultModelProfileId === modelId ? fallbackModelId : workspace.defaultModelProfileId,
    modelProfiles: remainingModels,
    agentProfiles: workspace.agentProfiles.map((agent) => ({
      ...agent,
      defaultModelProfileId: agent.defaultModelProfileId === modelId ? fallbackModelId : agent.defaultModelProfileId
    })),
    cards: workspace.cards.map((card) => ({
      ...card,
      modelProfileId: card.modelProfileId === modelId ? fallbackModelId : card.modelProfileId
    })),
    updatedAt: nowIso()
  };
};
