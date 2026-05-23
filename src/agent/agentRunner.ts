import { getModelProviderClient } from "./providers/providerRegistry";
import { secureKeyStore } from "../desktop/secureKeyStore";
import { buildAgentPrompt } from "../domain/promptBuilder";
import type { KanbanCard, Workspace } from "../domain/types";

export const runPlanOnly = async (
  workspace: Workspace,
  card: KanbanCard,
  onStream?: (message: string) => void
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
  const prompt = buildAgentPrompt(card, workspace, model, skills, agent);
  const apiKeyResult = await secureKeyStore.get(secureKeyStore.keyForModel(model.id));
  const apiKey = apiKeyResult.ok ? apiKeyResult.value : null;
  return getModelProviderClient(model.provider).runPlanOnly({ apiKey, model, onStream, prompt });
};
