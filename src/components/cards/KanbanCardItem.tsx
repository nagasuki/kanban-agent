import { CheckCircle2, Clock3, FileText, ShieldCheck } from "lucide-react";
import { BOARD_COLUMNS } from "../../domain/constants";
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
  const cliTool = workspace.cliToolProfiles.find((profile) => profile.id === (card.cliToolProfileId || workspace.defaultCliToolProfileId));
  const checklistDone = Object.values(card.reviewChecklist).filter(Boolean).length;
  const columnTitle = BOARD_COLUMNS.find((column) => column.id === card.columnId)?.title ?? "Workflow";
  const runnerLabel = card.runnerType === "cli" ? cliTool?.name ?? "No CLI" : model?.modelName ?? "No API model";

  return (
    <article
      aria-label={`Open card detail for ${card.title}`}
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
      <div className="card-status-row">
        <span className={`status-dot ${card.columnId}`} />
        <span>{columnTitle}</span>
        <span className="mini-badge">{card.priority}</span>
        {card.locked ? <span className="mini-badge warning-text">Running</span> : null}
      </div>
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
          {card.sessions.length} sessions
        </span>
        {card.rejectCount > 0 ? <span className="chip warning-text">{card.rejectCount} rejects</span> : null}
      </div>

      <div className="card-footer">
        <span>{skills[0]?.name ?? "No skill"}</span>
        <span>{runnerLabel}</span>
      </div>

      <div className="open-detail-hint">Click to open details</div>

      {card.columnId === "in-review" || card.columnId === "done" ? (
        <div className="review-meter">
          <ShieldCheck size={14} />
          {checklistDone}/6 review checks
        </div>
      ) : null}
    </article>
  );
};
