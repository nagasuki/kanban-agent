import { Copy, Trash2 } from "lucide-react";
import type { SkillPreset } from "../../domain/types";

interface SkillEditorProps {
  skill: SkillPreset;
  onUpdate: (updates: Partial<SkillPreset>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const SkillEditor = ({ skill, onUpdate, onDuplicate, onDelete }: SkillEditorProps) => {
  return (
    <section className="mini-editor">
      <div className="mini-editor-actions">
        <input value={skill.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        <button className="icon-button" title="Duplicate skill" type="button" onClick={onDuplicate}>
          <Copy size={15} />
        </button>
        <button className="icon-button danger" title="Delete skill" type="button" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>
      <label>
        Version
        <input value={skill.version} onChange={(event) => onUpdate({ version: event.target.value })} />
      </label>
      <textarea
        rows={2}
        value={skill.description}
        onChange={(event) => onUpdate({ description: event.target.value })}
      />
      <textarea rows={7} value={skill.markdown} onChange={(event) => onUpdate({ markdown: event.target.value })} />
    </section>
  );
};
