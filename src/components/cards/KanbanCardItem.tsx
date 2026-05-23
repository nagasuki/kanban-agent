import { CheckCircle2, Clock3, FileText, ShieldCheck } from "lucide-react";
import type { KanbanCard, Workspace } from "../../domain/types";

interface KanbanCardItemProps {
  card: KanbanCard;
  workspace: Workspace;
  isSelected: boolean;
  onSelect: () => void;
}

export const KanbanCardItem = ({ card, workspace, isSelected, onSelect }: KanbanCardItemProps) => {
  const skills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
  const model = workspace.modelProfiles.find((profile) => profile.id === card.modelProfileId);
  const checklistDone = Object.values(card.reviewChecklist).filter(Boolean).length;

  return (
    <article
      className={`kanban-card ${isSelected ? "selected" : ""}`}
      draggable
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="card-title-row">
        <h3>{card.title}</h3>
        {card.reviewChecklist.userApproved ? <CheckCircle2 className="success-icon" size={16} /> : null}
      </div>
      <p>{card.description}</p>

      <div className="card-chip-row">
        <span className="chip">
          <FileText size={13} />
          {card.executionMode}
        </span>
        <span className="chip">
          <Clock3 size={13} />
          {card.activityLog.length} logs
        </span>
      </div>

      <div className="card-footer">
        <span>{skills[0]?.name ?? "No skill"}</span>
        <span>{model?.modelName ?? "No model"}</span>
      </div>

      {card.columnId === "in-review" || card.columnId === "successfully" ? (
        <div className="review-meter">
          <ShieldCheck size={14} />
          {checklistDone}/6 review checks
        </div>
      ) : null}
    </article>
  );
};
