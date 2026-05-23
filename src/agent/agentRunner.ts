import { getModelProviderClient } from "./providers/providerRegistry";
import { buildAgentPrompt } from "../domain/promptBuilder";
import type { KanbanCard, Workspace } from "../domain/types";

export const runPlanOnly = async (workspace: Workspace, card: KanbanCard) => {
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
  return getModelProviderClient(model.provider).runPlanOnly({ model, prompt });
};
