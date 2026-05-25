import { cliBridge } from "../desktop/cliBridge";
import { buildAgentPrompt, buildPlanDraftPrompt } from "../domain/promptBuilder";
import {
  createProviderUsageRecord,
  estimateProviderCost,
  estimateTokensFromText
} from "../domain/providerUsageService";
import type { CliToolProfile, KanbanCard, ProviderUsageRecord, Workspace } from "../domain/types";

export interface CliAgentResult {
  ok: boolean;
  provider: string;
  summary: string;
  rawText: string;
  executionLogs?: string[];
  resolvedExecutablePath?: string;
  usageRecord?: ProviderUsageRecord;
}

export interface CliLiveUsageEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  wasEstimated: boolean;
}

export const runCliAgent = async (
  workspace: Workspace,
  card: KanbanCard,
  profile: CliToolProfile,
  onStream?: (message: string, usage?: CliLiveUsageEstimate) => void
): Promise<CliAgentResult> => {
  const model = workspace.modelProfiles.find((item) => item.id === card.modelProfileId);
  const skills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
  const agent = workspace.agentProfiles.find((item) => item.id === card.agentProfileId);
  const prompt = buildAgentPrompt(card, workspace, model, skills, agent, profile);
  const cwd = card.projectContext.repoPath || workspace.repoPath;
  const cliPrompt = [
    prompt.finalPromptPreview,
    "",
    "# CLI Runner Instructions",
    "You are being invoked by kanban-agent through a local CLI profile.",
    "Return output that can be reviewed inside the app.",
    "If the execution mode is Plan Only, do not edit files.",
    "If the execution mode is Suggest Patch, return a proposed patch/diff in text form for review.",
    "Do not commit or open a PR unless the card execution mode explicitly requests it and the prompt says approval has been granted."
  ].join("\n");

  const runningCard = workspace.cards.find((item) => item.id === card.id) ?? card;
  const activeSession = runningCard.sessions.find((session) => session.id === runningCard.activeSessionId);
  const providerId = profile.providerId || profile.provider.toLowerCase().replace(/\s+/g, "-");
  const inputTokens = estimateTokensFromText(cliPrompt);
  let streamedOutput = "";
  const emitUsage = () => {
    const outputTokens = estimateTokensFromText(streamedOutput);
    onStream?.("", {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: estimateProviderCost(providerId, inputTokens, outputTokens),
      wasEstimated: true
    });
  };

  const result = await cliBridge.run({
    args: profile.args,
    command: profile.command,
    cwd: profile.workingDirectory || cwd,
    environmentVariables: profile.environmentVariables,
    resolvedExecutablePath: profile.resolvedExecutablePath,
    runId: card.id,
    onOutput: (event) => {
      const clean = event.chunk.trim();
      streamedOutput += event.chunk;
      emitUsage();
      if (clean) {
        onStream?.(`${event.stream}: ${clean.slice(0, 500)}`);
      }
    },
    prompt: cliPrompt,
    timeoutSeconds: profile.timeoutSeconds
  });

  const output = [result.stdout, result.stderr ? `stderr:\n${result.stderr}` : ""].filter(Boolean).join("\n\n");
  const executionLogs = [
    result.resolvedExecutablePath ? `Resolved executable: ${result.resolvedExecutablePath}` : "",
    ...(result.logs ?? [])
      .filter((entry) => entry.stream !== "system")
      .map((entry) => `${entry.stream}: ${entry.chunk.trim().slice(0, 500)}`)
  ].filter(Boolean);
  const completedAt = new Date().toISOString();
  const usageRecord = activeSession
    ? createProviderUsageRecord({
        workspaceId: workspace.id,
        cardId: card.id,
        sessionId: activeSession.id,
        provider: profile,
        prompt: cliPrompt,
        stdout: result.stdout,
        stderr: result.stderr,
        startedAt: activeSession.startedAt,
        completedAt,
        cliVersion: profile.detectedVersion
      })
    : undefined;

  return {
    ok: result.ok,
    provider: profile.name,
    summary: result.ok
      ? `${profile.name} completed with exit code ${result.exitCode}.`
      : `${profile.name} failed${result.timedOut ? " after timing out" : result.cancelled ? " after cancellation" : ""}.`,
    rawText: output || "CLI produced no output.",
    executionLogs,
    resolvedExecutablePath: result.resolvedExecutablePath,
    usageRecord
  };
};

export const runCliPlanDraft = async (
  workspace: Workspace,
  card: KanbanCard,
  profile: CliToolProfile,
  onStream?: (message: string, usage?: CliLiveUsageEstimate) => void
): Promise<CliAgentResult> => {
  const model = workspace.modelProfiles.find((item) => item.id === card.modelProfileId);
  const skills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
  const agent = workspace.agentProfiles.find((item) => item.id === card.agentProfileId);
  const prompt = buildPlanDraftPrompt(card, workspace, model, skills, agent, profile);
  const cwd = card.projectContext.repoPath || workspace.repoPath;
  const cliPrompt = [
    prompt.finalPromptPreview,
    "",
    "# CLI Runner Instructions",
    "You are in Plan Mode for kanban-agent.",
    "Do not edit files, run commands, apply patches, commit, or open pull requests.",
    "Return only the markdown plan that should be saved into this card.",
    "Make the plan specific enough for a later implementation session."
  ].join("\n");

  const providerId = profile.providerId || profile.provider.toLowerCase().replace(/\s+/g, "-");
  const inputTokens = estimateTokensFromText(cliPrompt);
  let streamedOutput = "";
  const emitUsage = () => {
    const outputTokens = estimateTokensFromText(streamedOutput);
    onStream?.("", {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: estimateProviderCost(providerId, inputTokens, outputTokens),
      wasEstimated: true
    });
  };

  const result = await cliBridge.run({
    args: profile.args,
    command: profile.command,
    cwd: profile.workingDirectory || cwd,
    environmentVariables: profile.environmentVariables,
    resolvedExecutablePath: profile.resolvedExecutablePath,
    runId: card.id,
    onOutput: (event) => {
      const clean = event.chunk.trim();
      streamedOutput += event.chunk;
      emitUsage();
      if (clean) {
        onStream?.(`${event.stream}: ${clean.slice(0, 500)}`);
      }
    },
    prompt: cliPrompt,
    timeoutSeconds: profile.timeoutSeconds
  });

  const output = [result.stdout, result.stderr ? `stderr:\n${result.stderr}` : ""].filter(Boolean).join("\n\n");
  const executionLogs = [
    result.resolvedExecutablePath ? `Resolved executable: ${result.resolvedExecutablePath}` : "",
    ...(result.logs ?? [])
      .filter((entry) => entry.stream !== "system")
      .map((entry) => `${entry.stream}: ${entry.chunk.trim().slice(0, 500)}`)
  ].filter(Boolean);

  return {
    ok: result.ok,
    provider: profile.name,
    summary: result.ok
      ? `${profile.name} generated a plan with exit code ${result.exitCode}.`
      : `${profile.name} plan generation failed${result.timedOut ? " after timing out" : result.cancelled ? " after cancellation" : ""}.`,
    rawText: output || "CLI produced no plan output.",
    executionLogs,
    resolvedExecutablePath: result.resolvedExecutablePath
  };
};
