import { cliBridge } from "../desktop/cliBridge";
import { buildAgentPrompt } from "../domain/promptBuilder";
import type { CliToolProfile, KanbanCard, Workspace } from "../domain/types";

export interface CliAgentResult {
  ok: boolean;
  provider: string;
  summary: string;
  rawText: string;
}

export const runCliAgent = async (
  workspace: Workspace,
  card: KanbanCard,
  profile: CliToolProfile
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

  const result = await cliBridge.run({
    args: profile.args,
    command: profile.command,
    cwd,
    prompt: cliPrompt,
    timeoutSeconds: profile.timeoutSeconds
  });

  const output = [result.stdout, result.stderr ? `stderr:\n${result.stderr}` : ""].filter(Boolean).join("\n\n");

  return {
    ok: result.ok,
    provider: profile.name,
    summary: result.ok
      ? `${profile.name} completed with exit code ${result.exitCode}.`
      : `${profile.name} failed${result.timedOut ? " after timing out" : ""}.`,
    rawText: output || "CLI produced no output."
  };
};
