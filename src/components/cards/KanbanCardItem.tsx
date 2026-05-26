import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, Play, ShieldCheck, XCircle } from "lucide-react";
import { BOARD_COLUMNS } from "../../domain/constants";
import type { ImplementationSession, KanbanCard, Workspace } from "../../domain/types";

interface KanbanCardItemProps {
  card: KanbanCard;
  workspace: Workspace;
  columnIndex: number;
  isDragging: boolean;
  isSelected: boolean;
  onApplyPatch: (cardId: string) => void;
  onCancelCard: (cardId: string) => void;
  onDragEnd: () => void;
  onDragOverCard: (cardId: string, position: "before" | "after") => void;
  onDragStart: (cardId: string) => void;
  onReviewAction: (cardId: string, action: "approve" | "request-changes") => void;
  onSelect: () => void;
  onStartCard: (cardId: string) => void;
}

export const KanbanCardItem = ({
  card,
  workspace,
  columnIndex,
  isDragging,
  isSelected,
  onApplyPatch,
  onCancelCard,
  onDragEnd,
  onDragOverCard,
  onDragStart,
  onReviewAction,
  onSelect,
  onStartCard
}: KanbanCardItemProps) => {
  const [, setNow] = useState(Date.now());
  const agent = workspace.agentProfiles.find((profile) =>
    profile.id === (card.columnId === "my-plan" ? card.planAgentProfileId || card.agentProfileId : card.implementAgentProfileId || card.agentProfileId)
  );
  const latestSession = card.sessions.find((session) => session.id === card.activeSessionId) ?? card.sessions.at(-1);
  const columnTitle = BOARD_COLUMNS.find((column) => column.id === card.columnId)?.title ?? "Workflow";
  const isGeneratingPlan = card.columnId === "my-plan" && card.locked;

  useEffect(() => {
    if (card.columnId !== "in-process" && !isGeneratingPlan) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [card.columnId, isGeneratingPlan]);

  const renderBody = () => {
    if (isGeneratingPlan) {
      const latestLog = card.activityLog.at(-1)?.message || "Waiting for planner response";
      return (
        <>
          <div className="cli-status-card">
            <span>Generating plan</span>
            <span>{truncate(latestLog, 72)}</span>
            <span>Elapsed: {formatCardElapsed(card)}</span>
          </div>
          <div className="card-inline-actions">
            <button type="button" onClick={(event) => stopAndRun(event, () => onCancelCard(card.id))}>
              <XCircle size={13} />
              Cancel Plan
            </button>
          </div>
        </>
      );
    }

    if (card.columnId === "start-implement") {
      const blockedDependencies = card.dependencyCardIds
        .map((dependencyId) => workspace.cards.find((item) => item.id === dependencyId))
        .filter((dependency) => dependency && dependency.columnId !== "done");
      const ready = blockedDependencies.length === 0 && Boolean(agent);
      return (
        <>
          <CardSummary text={`Queue #${columnIndex + 1}`} />
          <div className="card-chip-row">
            <span className="chip">{agent?.name ?? "No agent"}</span>
            <span className={ready ? "chip success-text" : "chip warning-text"}>{ready ? "Ready" : "Needs setup"}</span>
            <span className="chip">{card.priority}</span>
          </div>
          {blockedDependencies.length > 0 ? (
            <p className="compact-card-note">Blocked by {blockedDependencies.map((item) => item?.title).join(", ")}</p>
          ) : null}
          <div className="card-inline-actions">
            <button type="button" onClick={(event) => stopAndRun(event, onSelect)}>
              Configure
            </button>
            <button type="button" onClick={(event) => stopAndRun(event, () => onStartCard(card.id))}>
              <Play size={13} />
              Implement
            </button>
          </div>
        </>
      );
    }

    if (card.columnId === "in-process") {
      const elapsed = formatElapsed(latestSession);
      const liveStatus = latestSession?.logs.at(-1)?.message || "Session is running";
      const currentFile = latestSession ? currentFileLabel(latestSession) : "";
      const pendingQuestion = card.pendingAgentQuestion;
      return (
        <>
          {pendingQuestion ? (
            <div className="agent-question-card">
              <span>
                <AlertTriangle size={13} />
                Needs your answer
              </span>
              <p>{truncate(pendingQuestion.question, 120)}</p>
              <small>Open this card to choose an answer.</small>
            </div>
          ) : null}
          <div className="cli-status-card">
            <span>Running: {latestSession?.currentStep || "Preparing session"}</span>
            <span>{latestSession?.status === "failed" ? "Failed" : truncate(liveStatus, 72)}</span>
            {currentFile ? <span>File: {truncate(currentFile, 72)}</span> : null}
            <span>Elapsed: {elapsed}</span>
            <span>Tokens: {formatTokens(latestSession)}{latestSession?.usageWasEstimated ? " est." : ""}</span>
            <span>Cost: {formatCost(latestSession)}</span>
          </div>
          <div className="card-inline-actions">
            <button type="button" onClick={(event) => stopAndRun(event, () => onCancelCard(card.id))}>
              <XCircle size={13} />
              Cancel
            </button>
          </div>
        </>
      );
    }

    if (card.columnId === "in-review") {
      const diffSummary = summarizeDiff(latestSession?.diffText || card.patchText || card.diffPlaceholder);
      return (
        <>
          <CardSummary text={latestSession?.summary || card.resultSummary || "Ready for human review."} />
          <div className="review-card-meta">
            <span>Changed files: {changedFileCount(latestSession, card)}</span>
            <span className={validationClass(latestSession)}>{validationSummary(latestSession)}</span>
          </div>
          <div className="diff-mini-preview">
            {diffSummary.map((line, index) => (
              <span className={line.className} key={`${line.text}-${line.className}-${index}`}>
                {line.text}
              </span>
            ))}
          </div>
          <div className="card-inline-actions review-card-actions">
            <button className="approve-action" type="button" onClick={(event) => stopAndRun(event, () => onReviewAction(card.id, "approve"))}>
              <ShieldCheck size={13} />
              Approve
            </button>
            <button className="apply-patch-action" type="button" onClick={(event) => stopAndRun(event, () => onApplyPatch(card.id))}>
              <FileCheck2 size={13} />
              Apply Patch
            </button>
            <button className="reject-action" type="button" onClick={(event) => stopAndRun(event, () => onReviewAction(card.id, "request-changes"))}>
              Reject
            </button>
          </div>
        </>
      );
    }

    if (card.columnId === "done") {
      return (
        <>
          <CardSummary text={latestSession?.summary || card.resultSummary || "Approved work completed."} />
          <div className="card-chip-row">
            <span className="chip success-text">
              <CheckCircle2 size={13} />
              Approved
            </span>
            <span className="chip">{agent?.name ?? "No agent"}</span>
          </div>
          <div className="done-card-meta">
            <span>{completionDate(latestSession, card)}</span>
            <span className={validationClass(latestSession)}>{validationSummary(latestSession)}</span>
          </div>
        </>
      );
    }

    return (
      <>
        <CardSummary text={card.description} />
        <div className="card-chip-row">
          <span className="chip">{card.priority}</span>
          {card.rejectCount > 0 ? <span className="chip warning-text">{card.rejectCount} rejects</span> : null}
          {agent ? <span className="chip">{agent.name}</span> : null}
        </div>
      </>
    );
  };

  return (
    <article
      aria-label={`Open card detail for ${card.title}`}
      className={`kanban-card ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""} ${isGeneratingPlan ? "locked" : ""}`}
      draggable={!isGeneratingPlan}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!isGeneratingPlan) {
          onSelect();
        }
      }}
      onDragStart={(event) => {
        if (isGeneratingPlan) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
        onDragStart(card.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        onDragOverCard(card.id, position);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!isGeneratingPlan) {
            onSelect();
          }
        }
      }}
    >
      <div className="card-status-row">
        <span className={`status-dot ${card.columnId}`} />
        <span>{columnTitle}</span>
        {card.columnId !== "my-plan" && card.columnId !== "start-implement" ? <span className="mini-badge">{card.priority}</span> : null}
      </div>
      <div className="card-title-row">
        <h3>{card.title}</h3>
        {card.reviewChecklist.userApproved ? <CheckCircle2 className="success-icon" size={16} /> : null}
      </div>
      {renderBody()}
      <div className="open-detail-hint">
        {isGeneratingPlan ? "Generating plan. Cancel or wait." : card.pendingAgentQuestion ? "Open card to answer" : "Click to open details"}
      </div>
    </article>
  );
};

const CardSummary = ({ text }: { text: string }) => <p className="card-summary">{truncate(text || "No summary yet.", 150)}</p>;

const stopAndRun = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
  event.stopPropagation();
  action();
};

const truncate = (value: string, maxLength: number) => {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
};

const formatElapsed = (session: ImplementationSession | undefined) => {
  if (!session?.startedAt) {
    return "00:00";
  }

  const seconds = session.completedAt
    ? session.durationSeconds
    : Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatTokens = (session: ImplementationSession | undefined) => {
  const tokens = session?.tokenUsage.totalTokens ?? 0;
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${tokens}`;
};

const formatCardElapsed = (card: KanbanCard) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(card.createdAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatCost = (session: ImplementationSession | undefined) => {
  const cost = session?.tokenUsage.costUsd ?? 0;
  if (cost <= 0) {
    return "$0.00";
  }
  return `~$${cost.toFixed(cost < 0.01 ? 4 : 2)}`;
};

const currentFileLabel = (session: ImplementationSession) => {
  if (session.changedFiles[0]) {
    return session.changedFiles[0];
  }
  const text = [session.currentStep, session.logs.at(-1)?.message ?? ""].join(" ");
  return text.match(/[A-Za-z0-9_\-./\\]+\.(?:ts|tsx|js|jsx|json|css|scss|md|cjs|mjs|cs|py|html|yml|yaml)/)?.[0] ?? "";
};

const changedFileCount = (session: ImplementationSession | undefined, card: KanbanCard) => {
  if (session?.changedFiles.length) {
    return session.changedFiles.length;
  }

  const diffText = session?.diffText || card.patchText || card.diffPlaceholder;
  return new Set(
    diffText
      .split(/\r?\n/)
      .filter((line) => line.startsWith("+++ b/"))
      .map((line) => line.slice("+++ b/".length).trim())
  ).size;
};

const summarizeDiff = (diffText: string) => {
  const lines = diffText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("+++ b/") || line.startsWith("+") || line.startsWith("-") || line.startsWith("~"))
    .filter((line) => !line.startsWith("+++") && !line.startsWith("---"))
    .slice(0, 4);

  if (lines.length === 0) {
    return [{ text: "No diff preview available.", className: "diff-context" }];
  }

  return lines.map((line) => ({
    text: truncate(line, 68),
    className: line.startsWith("+") ? "diff-add" : line.startsWith("-") ? "diff-remove" : "diff-context"
  }));
};

const validationSummary = (session: ImplementationSession | undefined) => {
  const results = session?.validationResults ?? [];
  if (results.some((result) => result.status === "failed")) return "Validation failed";
  if (results.some((result) => result.status === "pending")) return "Validation pending";
  if (results.some((result) => result.status === "passed")) return "Validation passed";
  return "Validation not run";
};

const validationClass = (session: ImplementationSession | undefined) => {
  const text = validationSummary(session);
  if (text.includes("failed")) return "warning-text";
  if (text.includes("passed")) return "success-text";
  return "";
};

const completionDate = (session: ImplementationSession | undefined, card: KanbanCard) =>
  new Date(session?.completedAt || card.updatedAt).toLocaleString();
