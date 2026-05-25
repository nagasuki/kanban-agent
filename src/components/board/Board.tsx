import { Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { getImplementCapableAgents, getPlanCapableAgents } from "../../domain/agentCapabilities";
import { BOARD_COLUMNS } from "../../domain/constants";
import { canUserCreateCard } from "../../domain/boardService";
import type { BoardColumnId, Workspace } from "../../domain/types";
import { KanbanCardItem } from "../cards/KanbanCardItem";

interface BoardProps {
  workspace: Workspace;
  compact: boolean;
  filterModelId: string;
  filterSkillId: string;
  filterStatus: string;
  searchQuery: string;
  selectedCardId: string | null;
  onOpenSettings?: () => void;
  onCancelCard: (cardId: string) => void;
  onSelectCard: (cardId: string) => void;
  onCreateCard: (columnId: BoardColumnId) => void;
  onColumnAgentChange: (columnId: "my-plan" | "start-implement", agentId: string) => void;
  onMoveCard: (cardId: string, targetColumnId: BoardColumnId) => void;
  onReorderCard: (cardId: string, targetColumnId: BoardColumnId, targetIndex: number) => void;
  onReviewAction: (cardId: string, action: "approve" | "request-changes") => void;
  onStartCard: (cardId: string) => void;
  onStartImplementAll: () => void;
}

export const Board = ({
  workspace,
  compact,
  filterModelId,
  filterSkillId,
  filterStatus,
  searchQuery,
  selectedCardId,
  onOpenSettings,
  onCancelCard,
  onSelectCard,
  onCreateCard,
  onColumnAgentChange,
  onMoveCard,
  onReorderCard,
  onReviewAction,
  onStartCard,
  onStartImplementAll
}: BoardProps) => {
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<BoardColumnId | null>(null);
  const [dropTarget, setDropTarget] = useState<{ cardId: string; position: "before" | "after" } | null>(null);
  useEffect(() => {
    if (!draggingCardId) {
      return undefined;
    }

    const clearDragState = () => {
      setDraggingCardId(null);
      setDragOverColumnId(null);
      setDropTarget(null);
    };

    window.addEventListener("dragend", clearDragState);
    window.addEventListener("drop", clearDragState);
    window.addEventListener("blur", clearDragState);
    return () => {
      window.removeEventListener("dragend", clearDragState);
      window.removeEventListener("drop", clearDragState);
      window.removeEventListener("blur", clearDragState);
    };
  }, [draggingCardId]);
  const query = searchQuery.trim().toLowerCase();
  const visibleCards = workspace.cards.filter((card) => {
    const matchesQuery =
      !query ||
      [card.title, card.description, card.projectContext.targetFiles, card.projectContext.targetFolders]
        .join(" ")
        .toLowerCase()
        .includes(query);
    const matchesSkill = !filterSkillId || card.skillIds.includes(filterSkillId);
    const matchesModel = !filterModelId || card.modelProfileId === filterModelId;
    const matchesStatus = !filterStatus || card.columnId === filterStatus;
    return matchesQuery && matchesSkill && matchesModel && matchesStatus;
  });
  const planAgents = getPlanCapableAgents(workspace);
  const implementAgents = getImplementCapableAgents(workspace);
  const selectedPlanAgentId =
    planAgents.find((agent) => agent.id === workspace.defaultPlanAgentProfileId)?.id ?? planAgents[0]?.id ?? "";
  const selectedImplementAgentId =
    implementAgents.find((agent) => agent.id === workspace.defaultImplementAgentProfileId)?.id ?? implementAgents[0]?.id ?? "";

  return (
    <section
      className={`board ${compact ? "compact-board" : ""}`}
      aria-label="Kanban board"
      onDragEnd={() => {
        setDraggingCardId(null);
        setDragOverColumnId(null);
        setDropTarget(null);
      }}
      onDrop={() => {
        setDraggingCardId(null);
        setDragOverColumnId(null);
        setDropTarget(null);
      }}
    >
      {BOARD_COLUMNS.map((column) => {
        const cards = visibleCards.filter((card) => card.columnId === column.id);

        return (
          <article
            className={`board-column ${dragOverColumnId === column.id ? "drag-over" : ""}`}
            key={column.id}
            onDragEnter={() => setDragOverColumnId(column.id)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDragOverColumnId(null);
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.stopPropagation();
              const target = dropTarget;
              setDraggingCardId(null);
              setDragOverColumnId(null);
              setDropTarget(null);
              const cardId = event.dataTransfer.getData("text/plain");
              if (cardId) {
                const targetCardIndex = target ? cards.findIndex((card) => card.id === target.cardId) : -1;
                if (targetCardIndex >= 0) {
                  onReorderCard(cardId, column.id, targetCardIndex + (target?.position === "after" ? 1 : 0));
                } else {
                  onMoveCard(cardId, column.id);
                }
              }
            }}
          >
            <header className="column-header">
              <div>
                <h2>{column.title}</h2>
                <p>{column.description}</p>
              </div>
              <span className="count-badge">{cards.length}</span>
            </header>

            {canUserCreateCard(column.id) ? (
              <div className="column-action-row">
                {column.id === "my-plan" ? (
                  <>
                  <label className="column-agent-selector">
                    <span>Planner</span>
                    <select
                      value={selectedPlanAgentId}
                      onChange={(event) => onColumnAgentChange("my-plan", event.target.value)}
                    >
                      <option value="">No Plan Agent</option>
                      {planAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="column-add" disabled={planAgents.length === 0} type="button" onClick={() => onCreateCard(column.id)}>
                    <Plus size={16} />
                    New plan
                  </button>
                  {planAgents.length === 0 ? (
                    <div className="column-warning">
                      No Plan Agent is configured. Please set up a Plan Agent first.
                      {onOpenSettings ? (
                        <button type="button" onClick={onOpenSettings}>
                          Open Settings
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  </>
                ) : null}
                {column.id === "start-implement" ? (
                  <>
                  <label className="column-agent-selector">
                    <span>Programmer</span>
                    <select
                      value={selectedImplementAgentId}
                      onChange={(event) => onColumnAgentChange("start-implement", event.target.value)}
                    >
                      <option value="">No Implement Agent</option>
                      {implementAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="column-add primary" disabled={cards.length === 0 || implementAgents.length === 0} type="button" onClick={onStartImplementAll}>
                    <Play size={16} />
                    Start Implement All
                  </button>
                  {implementAgents.length === 0 ? (
                    <div className="column-warning">
                      No Implement Agent is configured. Please set up an Implement Agent first.
                      {onOpenSettings ? (
                        <button type="button" onClick={onOpenSettings}>
                          Open Settings
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="system-column-note">System controlled</div>
            )}

            <div className="card-list">
              {dragOverColumnId === column.id && draggingCardId ? <div className="drop-preview">Drop here</div> : null}
              {cards.map((card, index) => (
                <div
                  className={`card-drop-frame ${
                    dropTarget?.cardId === card.id && draggingCardId !== card.id ? `drop-${dropTarget.position}` : ""
                  }`}
                  key={card.id}
                >
                  <KanbanCardItem
                    card={card}
                    columnIndex={index}
                    isDragging={draggingCardId === card.id}
                    isSelected={selectedCardId === card.id}
                    workspace={workspace}
                    onCancelCard={onCancelCard}
                    onDragOverCard={(cardId, position) => setDropTarget({ cardId, position })}
                    onDragStart={setDraggingCardId}
                    onDragEnd={() => {
                      setDraggingCardId(null);
                      setDragOverColumnId(null);
                      setDropTarget(null);
                    }}
                    onReviewAction={onReviewAction}
                    onSelect={() => onSelectCard(card.id)}
                    onStartCard={onStartCard}
                  />
                </div>
              ))}
              {cards.length === 0 ? (
                <div className="column-empty">
                  {canUserCreateCard(column.id) ? "Drop cards here or create a new one." : "Cards appear here through the workflow."}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
};
