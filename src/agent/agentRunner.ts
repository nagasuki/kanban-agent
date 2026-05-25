import { getModelProviderClient } from "./providers/providerRegistry";
import { secureKeyStore } from "../desktop/secureKeyStore";
import { buildAgentPrompt, buildPlanDraftPrompt } from "../domain/promptBuilder";
import { createModelProviderUsageRecord } from "../domain/providerUsageService";
import type { KanbanCard, Workspace } from "../domain/types";

export const runPlanOnly = async (
  workspace: Workspace,
  card: KanbanCard,
  onStream?: (message: string) => void,
  signal?: AbortSignal
) => {
  const model = workspace.modelProfiles.find((profile) => profile.id === card.modelProfileId);
  if (!model) {
    return {
      summary: "Plan Only could not run because no model profile is selected.",
      rawText: "Select a model profile before running Plan Only.",
      provider: "none"
    };
  }

  const skills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
  const agent = workspace.agentProfiles.find((profile) => profile.id === card.agentProfileId);
  const cliTool = workspace.cliToolProfiles.find((profile) => profile.id === card.cliToolProfileId);
  const prompt = buildAgentPrompt(card, workspace, model, skills, agent, cliTool);
  const apiKeyResult = await secureKeyStore.get(secureKeyStore.keyForModel(model.id));
  const apiKey = apiKeyResult.ok ? apiKeyResult.value : null;
  const runningCard = workspace.cards.find((item) => item.id === card.id) ?? card;
  const activeSession = runningCard.sessions.find((session) => session.id === runningCard.activeSessionId);
  const result = await getModelProviderClient(model.provider).runPlanOnly({ apiKey, model, onStream, prompt, signal });
  if (!activeSession) {
    return result;
  }
  const completedAt = new Date().toISOString();
  return {
    ...result,
    usageRecord: createModelProviderUsageRecord({
      workspaceId: workspace.id,
      cardId: card.id,
      sessionId: activeSession.id,
      model,
      prompt: prompt.finalPromptPreview,
      output: result.rawText,
      startedAt: activeSession.startedAt,
      completedAt
    })
  };
};

export const runPlanDraft = async (
  workspace: Workspace,
  card: KanbanCard,
  onStream?: (message: string) => void,
  signal?: AbortSignal
) => {
  const model = workspace.modelProfiles.find((profile) => profile.id === card.modelProfileId);
  if (!model) {
    return {
      summary: "Plan draft could not run because no model profile is selected.",
      rawText: "Select a model profile before generating a plan.",
      provider: "none"
    };
  }

  const skills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
  const agent = workspace.agentProfiles.find((profile) => profile.id === card.agentProfileId);
  const cliTool = workspace.cliToolProfiles.find((profile) => profile.id === card.cliToolProfileId);
  const prompt = buildPlanDraftPrompt(card, workspace, model, skills, agent, cliTool);
  const apiKeyResult = await secureKeyStore.get(secureKeyStore.keyForModel(model.id));
  const apiKey = apiKeyResult.ok ? apiKeyResult.value : null;
  return getModelProviderClient(model.provider).runPlanOnly({ apiKey, model, onStream, prompt, signal });
};
