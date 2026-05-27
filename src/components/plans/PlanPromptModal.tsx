import { useState } from "react";
import { Play, X } from "lucide-react";
import type { CreatePlanCardOptions } from "../../domain/boardService";
import { planAgentsForWorkspace } from "../../domain/agentCapabilities";
import type { Workspace } from "../../domain/types";

interface PlanPromptModalProps {
  isGenerating: boolean;
  onClose: () => void;
  onManualSubmit: (prompt: string, options: CreatePlanCardOptions) => void | Promise<void>;
  onSubmit: (prompt: string, options: CreatePlanCardOptions) => void | Promise<void>;
  workspace: Workspace;
}

export const PlanPromptModal = ({ isGenerating, onClose, onManualSubmit, onSubmit, workspace }: PlanPromptModalProps) => {
  const planAgents = planAgentsForWorkspace(workspace);
  const defaultAgent = planAgents.find((profile) => profile.id === workspace.defaultPlanAgentProfileId) ?? planAgents[0];
  const [prompt, setPrompt] = useState("");
  const [agentProfileId, setAgentProfileId] = useState(defaultAgent?.id || "");
  const selectedAgent = planAgents.find((profile) => profile.id === (agentProfileId || defaultAgent?.id));
  const runnerType = selectedAgent?.defaultRunnerType ?? (workspace.defaultCliToolProfileId ? "cli" : "api");
  const modelProfileId = selectedAgent?.defaultModelProfileId || workspace.defaultModelProfileId || workspace.modelProfiles[0]?.id || "";
  const cliToolProfileId = selectedAgent?.defaultCliToolProfileId || workspace.defaultCliToolProfileId || workspace.cliToolProfiles[0]?.id || "";
  const selectedModel = workspace.modelProfiles.find((model) => model.id === modelProfileId);
  const selectedCliTool = workspace.cliToolProfiles.find((profile) => profile.id === cliToolProfileId);
  const selectedOptions: CreatePlanCardOptions = {
    agentProfileId: agentProfileId || defaultAgent?.id || undefined,
    runnerType,
    modelProfileId,
    cliToolProfileId: cliToolProfileId || undefined
  };

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={isGenerating ? undefined : onClose}>
      <section
        aria-label="Create plan from prompt"
        aria-modal="true"
        className="plan-prompt-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-modal-header drawer-header">
          <div>
            <p className="eyebrow">Plan Mode</p>
            <h2>Create Plan</h2>
          </div>
          <button className="icon-button" disabled={isGenerating} title="Close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <form
          className="plan-prompt-body"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(prompt, selectedOptions);
          }}
        >
          <div className="settings-form-grid">
            <label>
              Planner agent
              <select
                disabled={isGenerating}
                value={agentProfileId}
                onChange={(event) => setAgentProfileId(event.target.value)}
              >
                <option value="">Use workspace Default Plan Agent</option>
                {planAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="plan-agent-preview">
              <span>Runner: {runnerType === "cli" ? "CLI Agent" : "API Model"}</span>
              <span>
                {runnerType === "cli"
                  ? `CLI: ${selectedCliTool?.name ?? "Not selected"}`
                  : `Model: ${selectedModel ? `${selectedModel.name} / ${selectedModel.modelName}` : "Not selected"}`}
              </span>
            </div>
          </div>

          <label>
            Prompt
            <textarea
              autoFocus
              disabled={isGenerating}
              placeholder="Describe what you want the AI agent to plan..."
              rows={10}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>

          <div className="review-actions">
            <button disabled={isGenerating || !prompt.trim()} type="button" onClick={() => onManualSubmit(prompt, selectedOptions)}>
              Manual Plan
            </button>
            <button disabled={isGenerating || !prompt.trim() || !selectedAgent || (runnerType === "api" ? !modelProfileId : !cliToolProfileId)} type="submit">
              <Play size={15} />
              {isGenerating ? "Generating plan..." : "Generate Plan Card"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
