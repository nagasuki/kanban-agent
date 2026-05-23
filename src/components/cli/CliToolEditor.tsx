import { Trash2 } from "lucide-react";
import type { CliToolProfile } from "../../domain/types";

interface CliToolEditorProps {
  profile: CliToolProfile;
  onDelete: () => void;
  onUpdate: (updates: Partial<CliToolProfile>) => void;
}

export const CliToolEditor = ({ profile, onDelete, onUpdate }: CliToolEditorProps) => {
  return (
    <section className="mini-editor">
      <div className="mini-editor-actions">
        <input value={profile.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        <button className="icon-button danger" title="Delete CLI profile" type="button" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>

      <label>
        Provider
        <select
          value={profile.provider}
          onChange={(event) => onUpdate({ provider: event.target.value as CliToolProfile["provider"] })}
        >
          <option value="Claude Code">Claude Code</option>
          <option value="Codex">Codex</option>
          <option value="Custom CLI">Custom CLI</option>
        </select>
      </label>

      <label>
        Command
        <input value={profile.command} onChange={(event) => onUpdate({ command: event.target.value })} />
      </label>

      <label>
        Args
        <input
          value={profile.args}
          onChange={(event) => onUpdate({ args: event.target.value })}
          placeholder="optional flags; prompt is sent through stdin"
        />
      </label>

      <label>
        Timeout seconds
        <input
          min={10}
          step={30}
          type="number"
          value={profile.timeoutSeconds}
          onChange={(event) => onUpdate({ timeoutSeconds: Number(event.target.value) })}
        />
      </label>

      <p className="helper-text">The generated prompt is piped to stdin. Keep command/args configurable for your CLI version.</p>
    </section>
  );
};
