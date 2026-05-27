import { Play, X } from "lucide-react";
import { useState } from "react";
import type { KanbanCard } from "../../domain/types";

interface PauseResumeModalProps {
  card: KanbanCard;
  onClose: () => void;
  onResume: (cardId: string, guidance: string) => void | Promise<void>;
}

export const PauseResumeModal = ({ card, onClose, onResume }: PauseResumeModalProps) => {
  const [guidance, setGuidance] = useState("");
  const latestSession = card.sessions.find((session) => session.id === card.activeSessionId) ?? card.sessions.at(-1);
  const recentLogs = [...(latestSession?.logs ?? card.activityLog)].slice(-8).reverse();

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={`Pause guidance for ${card.title}`}
        aria-modal="true"
        className="pause-resume-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-modal-header drawer-header">
          <div>
            <p className="eyebrow">Paused Session</p>
            <h2>{card.title}</h2>
          </div>
          <button className="icon-button" title="Close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="pause-resume-body">
          <section className="pause-summary">
            <span>Status: {latestSession?.currentStep || "Paused"}</span>
            <span>Attempt: {latestSession?.attemptNumber ?? card.sessions.length}</span>
            <span>Runner: {latestSession?.runnerType === "cli" ? "CLI" : "API Model"}</span>
          </section>

          <section>
            <h3>Recent Activity</h3>
            <div className="pause-log-list">
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <div className={`log-entry ${log.level}`} key={log.id}>
                    <strong>{new Date(log.timestamp).toLocaleTimeString()}</strong>
                    <p>{log.message}</p>
                  </div>
                ))
              ) : (
                <p className="helper-text">No activity has been logged yet.</p>
              )}
            </div>
          </section>

          <label>
            Resume guidance
            <textarea
              autoFocus
              rows={7}
              value={guidance}
              placeholder="Tell the agent what to adjust before it continues..."
              onChange={(event) => setGuidance(event.target.value)}
            />
          </label>

          <div className="review-actions">
            <button type="button" onClick={onClose}>
              Keep Paused
            </button>
            <button className="approve-action" disabled={!guidance.trim()} type="button" onClick={() => onResume(card.id, guidance)}>
              <Play size={15} />
              Resume
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
