import { Plus } from "lucide-react";
import { BOARD_COLUMNS } from "../../domain/constants";
import type { BoardColumnId, Workspace } from "../../domain/types";
import { KanbanCardItem } from "../cards/KanbanCardItem";

interface BoardProps {
  workspace: Workspace;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onCreateCard: (columnId: BoardColumnId) => void;
  onMoveCard: (cardId: string, targetColumnId: BoardColumnId) => void;
}

export const Board = ({ workspace, selectedCardId, onSelectCard, onCreateCard, onMoveCard }: BoardProps) => {
  return (
    <section className="board" aria-label="Kanban board">
      {BOARD_COLUMNS.map((column) => {
        const cards = workspace.cards.filter((card) => card.columnId === column.id);

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
            </div>
          </article>
        );
      })}
    </section>
  );
};
