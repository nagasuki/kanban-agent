import { createId, nowIso } from "./id";
import type { AgentProfile, Workspace } from "./types";

export const createAgentProfile = (workspace: Workspace): Workspace => {
  const timestamp = nowIso();
  const agent: AgentProfile = {
    id: createId("agent"),
    name: "New Agent Profile",
    skillIds: workspace.skills[0] ? [workspace.skills[0].id] : [],
    defaultRunnerType: workspace.defaultCliToolProfileId ? "cli" : "api",
    defaultModelProfileId: workspace.defaultModelProfileId,
    defaultCliToolProfileId: workspace.defaultCliToolProfileId,
    defaultExecutionMode: "Suggest Patch",
    notes: "Default instructions for this reusable agent profile.",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...workspace,
    defaultAgentProfileId: workspace.defaultAgentProfileId || agent.id,
    agentProfiles: [agent, ...workspace.agentProfiles],
    updatedAt: timestamp
  };
};

export const updateAgentProfile = (
  workspace: Workspace,
  agentId: string,
  updates: Partial<AgentProfile>
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    agentProfiles: workspace.agentProfiles.map((agent) =>
      agent.id === agentId
        ? {
            ...agent,
            ...updates,
            updatedAt: timestamp
          }
        : agent
    ),
    updatedAt: timestamp
  };
};

export const deleteAgentProfile = (workspace: Workspace, agentId: string): Workspace => {
  const remainingAgents = workspace.agentProfiles.filter((agent) => agent.id !== agentId);
  const fallbackAgentId = remainingAgents[0]?.id ?? "";

  return {
    ...workspace,
    defaultAgentProfileId: workspace.defaultAgentProfileId === agentId ? fallbackAgentId : workspace.defaultAgentProfileId,
    agentProfiles: remainingAgents,
    cards: workspace.cards.map((card) => ({
      ...card,
      agentProfileId: card.agentProfileId === agentId ? undefined : card.agentProfileId
    })),
    updatedAt: nowIso()
  };
};
