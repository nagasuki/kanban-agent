import type { AgentProfile, Workspace } from "./types";

export const supportsPlanMode = (agent: AgentProfile | undefined): agent is AgentProfile =>
  Boolean(agent && (agent.mode === "plan" || agent.mode === "both"));

export const supportsImplementMode = (agent: AgentProfile | undefined): agent is AgentProfile =>
  Boolean(agent && (agent.mode === "implement" || agent.mode === "both"));

export const planAgentsForWorkspace = (workspace: Workspace): AgentProfile[] =>
  workspace.agentProfiles.filter(supportsPlanMode);

export const implementAgentsForWorkspace = (workspace: Workspace): AgentProfile[] =>
  workspace.agentProfiles.filter(supportsImplementMode);

export const getPlanCapableAgents = planAgentsForWorkspace;
export const getImplementCapableAgents = implementAgentsForWorkspace;
export const canAgentPlan = supportsPlanMode;
export const canAgentImplement = supportsImplementMode;

export const resolvePlanAgent = (workspace: Workspace, agentId?: string): AgentProfile | undefined =>
  planAgentsForWorkspace(workspace).find((agent) => agent.id === agentId) ??
  planAgentsForWorkspace(workspace).find(
    (agent) => agent.id === (workspace.defaultPlanAgentProfileId || workspace.defaultAgentProfileId)
  );

export const resolveImplementAgent = (workspace: Workspace, agentId?: string): AgentProfile | undefined =>
  implementAgentsForWorkspace(workspace).find((agent) => agent.id === agentId) ??
  implementAgentsForWorkspace(workspace).find(
    (agent) => agent.id === (workspace.defaultImplementAgentProfileId || workspace.defaultAgentProfileId)
  );

export const resolvePlanAgentForCard = (
  card: { planAgentProfileId?: string; agentProfileId?: string },
  workspace: Workspace,
  selectedColumnAgentId?: string
): AgentProfile | undefined =>
  resolvePlanAgent(workspace, card.planAgentProfileId) ??
  resolvePlanAgent(workspace, selectedColumnAgentId) ??
  resolvePlanAgent(workspace, card.agentProfileId);

export const resolveImplementAgentForCard = (
  card: { implementAgentProfileId?: string; agentProfileId?: string },
  workspace: Workspace,
  selectedColumnAgentId?: string
): AgentProfile | undefined =>
  resolveImplementAgent(workspace, card.implementAgentProfileId) ??
  resolveImplementAgent(workspace, selectedColumnAgentId) ??
  resolveImplementAgent(workspace, card.agentProfileId);
