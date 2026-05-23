import { Trash2 } from "lucide-react";
import { EXECUTION_MODES } from "../../domain/constants";
import type { AgentProfile, Workspace } from "../../domain/types";

interface AgentEditorProps {
  agent: AgentProfile;
  workspace: Workspace;
  onUpdate: (updates: Partial<AgentProfile>) => void;
  onDelete: () => void;
}

export const AgentEditor = ({ agent, workspace, onUpdate, onDelete }: AgentEditorProps) => {
  return (
    <section className="mini-editor">
      <div className="mini-editor-actions">
        <input value={agent.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        <button className="icon-button danger" title="Delete agent profile" type="button" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="checkbox-list">
        {workspace.skills.map((skill) => (
          <label className="checkbox-row" key={skill.id}>
            <input
              checked={agent.skillIds.includes(skill.id)}
              type="checkbox"
              onChange={(event) => {
                const skillIds = event.target.checked
                  ? [...agent.skillIds, skill.id]
                  : agent.skillIds.filter((id) => id !== skill.id);
                onUpdate({ skillIds });
              }}
            />
            {skill.name}
          </label>
        ))}
      </div>

      <label>
        Default model
        <select
          value={agent.defaultModelProfileId}
          onChange={(event) => onUpdate({ defaultModelProfileId: event.target.value })}
        >
          <option value="">No model</option>
          {workspace.modelProfiles.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Default execution mode
        <select
          value={agent.defaultExecutionMode}
          onChange={(event) => onUpdate({ defaultExecutionMode: event.target.value as AgentProfile["defaultExecutionMode"] })}
        >
          {EXECUTION_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>

      <label>
        Notes
        <textarea rows={3} value={agent.notes} onChange={(event) => onUpdate({ notes: event.target.value })} />
      </label>
    </section>
  );
};
