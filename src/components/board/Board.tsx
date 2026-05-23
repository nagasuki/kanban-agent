import { Plus } from "lucide-react";
import { BOARD_COLUMNS } from "../../domain/constants";
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
  onSelectCard: (cardId: string) => void;
  onCreateCard: (columnId: BoardColumnId) => void;
  onMoveCard: (cardId: string, targetColumnId: BoardColumnId) => void;
}

export const Board = ({
  workspace,
  compact,
  filterModelId,
  filterSkillId,
  filterStatus,
  searchQuery,
  selectedCardId,
  onSelectCard,
  onCreateCard,
  onMoveCard
}: BoardProps) => {
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

  return (
    <section className={`board ${compact ? "compact-board" : ""}`} aria-label="Kanban board">
      {BOARD_COLUMNS.map((column) => {
        const cards = visibleCards.filter((card) => card.columnId === column.id);

        return (
          <article
            className="board-column"
            key={column.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const cardId = event.dataTransfer.getData("text/plain");
              if (cardId) {
                onMoveCard(cardId, column.id);
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

            <button className="column-add" type="button" onClick={() => onCreateCard(column.id)}>
              <Plus size={16} />
              New card
            </button>

            <div className="card-list">
              {cards.map((card) => (
                <KanbanCardItem
                  card={card}
                  isSelected={selectedCardId === card.id}
                  key={card.id}
                  workspace={workspace}
                  onSelect={() => onSelectCard(card.id)}
                />
              ))}
              {cards.length === 0 ? <div className="column-empty">Drop cards here or create a new one.</div> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
};
