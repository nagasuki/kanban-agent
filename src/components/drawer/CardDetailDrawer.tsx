import { useEffect } from "react";
import { AlertTriangle, Copy, Play, RotateCcw, Send, ShieldCheck, Trash2, Undo2, X } from "lucide-react";
import { BOARD_COLUMNS, EXECUTION_MODES, TASK_PRIORITIES } from "../../domain/constants";
import { buildExecutionPreview } from "../../domain/executionService";
import { buildAgentPrompt } from "../../domain/promptBuilder";
import { implementAgentsForWorkspace, planAgentsForWorkspace } from "../../domain/agentCapabilities";
import type { KanbanCard, SessionRetryMode, Workspace } from "../../domain/types";
import { DiffViewer } from "../diff/DiffViewer";
import { FileTreePicker } from "./FileTreePicker";

interface CardDetailModalProps {
  card: KanbanCard | undefined;
  workspace: Workspace;
  onClose: () => void;
  onUpdateCard: (cardId: string, updates: Partial<KanbanCard>) => void;
  onDeleteCard: (cardId: string) => void;
  onDuplicateCard: (cardId: string) => void;
  onSendToImplement: (cardId: string) => void;
  onBackToPlan: (cardId: string) => void;
  onReviewAction: (cardId: string, action: "approve" | "request-changes" | "retry" | "rollback") => void;
  onSimulateExecution: (cardId: string) => void;
  onCancelExecution: (cardId: string) => void;
  onAnswerAgentQuestion: (cardId: string, answer: string) => void;
  onRunPlanOnly: (cardId: string, retryMode?: SessionRetryMode) => void;
  onLoadAttachedFiles: (cardId: string) => void;
  onRunCliAgent: (cardId: string, retryMode?: SessionRetryMode) => void;
  onApplyPatch: (cardId: string) => void;
  onRunWorkspaceCommand: (cardId: string, kind: "test" | "build") => void;
  onCommit: (cardId: string) => void;
  onGeneratePrDraft: (cardId: string) => void;
  onRollbackFiles: (cardId: string) => void;
  onCreatePr: (cardId: string) => void;
}

const safetyLabels: Record<keyof KanbanCard["safetySettings"], string> = {
  previewDiffBeforeApply: "Preview diff before apply",
  backupBeforeEdit: "Backup before edit",
  restrictEditableFolders: "Restrict editable folders",
  blockedSecretFiles: "Block .env / secret files",
  requireApprovalBeforeCommit: "Require approval before commit",
  requireApprovalBeforePr: "Require approval before PR"
};

const checklistLabels: Record<keyof KanbanCard["reviewChecklist"], string> = {
  scopeMatchesPlan: "Scope matches plan",
  buildTestPassed: "Build/Test passed",
  codeStyleAcceptable: "Code style acceptable",
  noRiskyFileChanged: "No risky file changed",
  summaryIsClear: "Summary is clear",
  userApproved: "User approved"
};

export const CardDetailModal = ({
  card,
  workspace,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
  onSendToImplement,
  onBackToPlan,
  onReviewAction,
  onSimulateExecution,
  onCancelExecution,
  onAnswerAgentQuestion,
  onRunPlanOnly,
  onLoadAttachedFiles,
  onRunCliAgent,
  onApplyPatch,
  onRunWorkspaceCommand,
  onCommit,
  onGeneratePrDraft,
  onRollbackFiles,
  onCreatePr
}: CardDetailModalProps) => {
  useEffect(() => {
    if (!card) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [card, onClose]);

  if (!card) {
    return null;
  }

  const planAgents = planAgentsForWorkspace(workspace);
  const implementAgents = implementAgentsForWorkspace(workspace);
  const selectedPlanAgent = workspace.agentProfiles.find((agent) => agent.id === (card.planAgentProfileId || card.agentProfileId));
  const selectedImplementAgent = workspace.agentProfiles.find((agent) => agent.id === (card.implementAgentProfileId || card.agentProfileId));
  const selectedAgent = card.columnId === "my-plan" ? selectedPlanAgent : selectedImplementAgent;
  const selectedSkillIds = selectedAgent?.skillIds ?? card.skillIds;
  const selectedSkills = workspace.skills.filter((skill) => selectedSkillIds.includes(skill.id));
  const selectedModel = workspace.modelProfiles.find((model) => model.id === card.modelProfileId);
  const selectedCliTool = workspace.cliToolProfiles.find(
    (profile) => profile.id === (card.cliToolProfileId || workspace.defaultCliToolProfileId)
  );
  const executionPreview = buildExecutionPreview(card, selectedModel, selectedSkills, selectedCliTool);
  const generatedPrompt = buildAgentPrompt(card, workspace, selectedModel, selectedSkills, selectedAgent, selectedCliTool);
  const activeSession = card.sessions.find((session) => session.id === card.activeSessionId);
  const latestSession = activeSession ?? card.sessions.at(-1);
  const canStartSession = card.columnId === "start-implement";
  const startSession = (retryMode: SessionRetryMode = "fresh") => {
    const runnerType = selectedImplementAgent?.defaultRunnerType ?? card.runnerType;
    if (runnerType === "cli") {
      onRunCliAgent(card.id, retryMode);
      return;
    }
    onRunPlanOnly(card.id, retryMode);
  };
  const applyAgentProfile = (agentId: string, role: "plan" | "implement") => {
    const agent = workspace.agentProfiles.find((profile) => profile.id === agentId);
    if (role === "plan") {
      onUpdateCard(
        card.id,
        agent
          ? {
              agentProfileId: agent.id,
              planAgentProfileId: agent.id,
              skillIds: agent.skillIds,
              runnerType: agent.defaultRunnerType,
              modelProfileId: agent.defaultModelProfileId,
              cliToolProfileId: agent.defaultCliToolProfileId || undefined,
              executionMode: "Plan Only"
            }
          : { planAgentProfileId: undefined }
      );
      return;
    }

    onUpdateCard(
      card.id,
      agent
        ? card.columnId === "my-plan"
          ? { implementAgentProfileId: agent.id }
          : {
              agentProfileId: agent.id,
              implementAgentProfileId: agent.id,
              skillIds: agent.skillIds,
              runnerType: agent.defaultRunnerType,
              modelProfileId: agent.defaultModelProfileId,
              cliToolProfileId: agent.defaultCliToolProfileId || undefined,
              executionMode: agent.defaultExecutionMode
            }
        : { implementAgentProfileId: undefined }
    );
  };
  const attachFile = (path: string) => {
    const files = splitList(card.projectContext.targetFiles);
    if (files.includes(path)) {
      return;
    }

    onUpdateCard(card.id, {
      projectContext: {
        ...card.projectContext,
        targetFiles: [...files, path].join(", ")
      }
    });
  };

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={`Card detail: ${card.title}`}
        aria-modal="true"
        className="detail-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
      <header className="detail-modal-header drawer-header">
        <div>
          <p className="eyebrow">{BOARD_COLUMNS.find((column) => column.id === card.columnId)?.title}</p>
          <h2>{card.title}</h2>
        </div>
        <button className="icon-button" title="Close details" type="button" onClick={onClose}>
          <X size={18} />
        </button>
      </header>

      <div className="detail-modal-body">
      <div className="drawer-actions">
        {card.columnId === "my-plan" && !card.locked ? (
          <button type="button" onClick={() => onSendToImplement(card.id)}>
            <Play size={15} />
            Send to Implement
          </button>
        ) : null}
        {card.columnId === "start-implement" ? (
          <button type="button" onClick={() => onBackToPlan(card.id)}>
            <Undo2 size={15} />
            Back to Plan
          </button>
        ) : null}
        {canStartSession ? (
          <button type="button" onClick={() => startSession("fresh")}>
            <Play size={15} />
            Implement
          </button>
        ) : null}
        {card.columnId === "in-process" ? (
          <button type="button" onClick={() => onCancelExecution(card.id)}>
            <Undo2 size={15} />
            Cancel Session
          </button>
        ) : null}
        {card.columnId === "in-review" ? (
          <>
            <button type="button" onClick={() => onReviewAction(card.id, "approve")}>
              <ShieldCheck size={15} />
              Approve
            </button>
            <button type="button" onClick={() => onReviewAction(card.id, "request-changes")}>
              <Undo2 size={15} />
              Reject
            </button>
          </>
        ) : null}
        {card.locked ? <span className="status-pill warning-text">Locked</span> : null}
        {card.columnId === "in-process" && latestSession?.logs.length ? (
          <button type="button" onClick={() => document.getElementById(`logs-${card.id}`)?.scrollIntoView({ behavior: "smooth" })}>
            <Copy size={15} />
            Open Logs
          </button>
        ) : null}
        {card.columnId === "my-plan" || card.columnId === "done" ? (
        <button className="danger-text-button" type="button" onClick={() => onDeleteCard(card.id)}>
          <Trash2 size={15} />
          Delete
        </button>
        ) : null}
      </div>

      {card.columnId === "in-process" && card.pendingAgentQuestion ? (
        <section className="drawer-section agent-question-panel">
          <h3>
            <AlertTriangle size={16} />
            Agent Question
          </h3>
          <p>{card.pendingAgentQuestion.question}</p>
          <div className="agent-choice-list">
            {card.pendingAgentQuestion.choices.map((choice, index) => (
              <button key={`${choice}-${index}`} type="button" onClick={() => onAnswerAgentQuestion(card.id, choice)}>
                <Send size={14} />
                {choice}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="drawer-section">
        <label>
          Title
          <input value={card.title} onChange={(event) => onUpdateCard(card.id, { title: event.target.value })} />
        </label>
        <label>
          Plan markdown
          <textarea
            rows={8}
            value={card.description}
            onChange={(event) => onUpdateCard(card.id, { description: event.target.value })}
          />
        </label>
      </section>

      <section className="drawer-section" id={`logs-${card.id}`}>
        <h3>Agent Context</h3>
        {card.columnId === "my-plan" ? (
        <label>
          Plan Agent
          <select
            value={card.planAgentProfileId ?? card.agentProfileId ?? ""}
            onChange={(event) => applyAgentProfile(event.target.value, "plan")}
          >
            <option value="">No Plan Agent selected</option>
            {planAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        ) : null}

        {card.columnId === "my-plan" || card.columnId === "start-implement" || card.columnId === "in-process" ? (
        <label>
          Implement Agent
          <select
            value={card.implementAgentProfileId ?? ""}
            onChange={(event) => applyAgentProfile(event.target.value, "implement")}
          >
            <option value="">No Implement Agent selected</option>
            {implementAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        ) : null}

        <div className="repo-meta-row">
          {card.columnId === "my-plan" ? <span>Plan Agent: {selectedPlanAgent?.name ?? "Not selected"}</span> : null}
          {card.columnId !== "my-plan" ? <span>Implement Agent: {selectedImplementAgent?.name ?? "Not selected"}</span> : null}
          <span>Skills: {selectedSkills.length > 0 ? selectedSkills.map((skill) => skill.name).join(", ") : "No agent skills"}</span>
          {card.rejectCount > 0 ? <span className="warning-text">{card.rejectCount} rejects</span> : null}
        </div>

        {card.columnId !== "my-plan" ? (
        <>
        <label>
          Runner
          <select
            value={card.runnerType}
            onChange={(event) => onUpdateCard(card.id, { runnerType: event.target.value as KanbanCard["runnerType"] })}
          >
            <option value="cli">CLI Agent</option>
            <option value="api">API Model</option>
          </select>
        </label>

        {card.runnerType === "api" ? (
          <label>
            API model profile
            <select value={card.modelProfileId} onChange={(event) => onUpdateCard(card.id, { modelProfileId: event.target.value })}>
              <option value="">No model selected</option>
              {workspace.modelProfiles.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {card.runnerType === "cli" ? (
          <label>
            CLI profile
            <select
              value={card.cliToolProfileId ?? workspace.defaultCliToolProfileId}
              onChange={(event) => onUpdateCard(card.id, { cliToolProfileId: event.target.value || undefined })}
            >
              <option value="">No CLI selected</option>
              {workspace.cliToolProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        </>
        ) : null}

        <label>
          Execution mode
          <select
            value={card.executionMode}
            onChange={(event) => onUpdateCard(card.id, { executionMode: event.target.value as KanbanCard["executionMode"] })}
          >
            {EXECUTION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="drawer-section">
        <h3>Queue Settings</h3>
        <label>
          Priority
          <select
            value={card.priority}
            onChange={(event) => onUpdateCard(card.id, { priority: event.target.value as KanbanCard["priority"] })}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dependencies
          <select
            multiple
            value={card.dependencyCardIds}
            onChange={(event) =>
              onUpdateCard(card.id, {
                dependencyCardIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value)
              })
            }
          >
            {workspace.cards
              .filter((item) => item.id !== card.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({BOARD_COLUMNS.find((column) => column.id === item.columnId)?.title})
                </option>
              ))}
          </select>
        </label>
        <div className="checkbox-list">
          <label className="checkbox-row">
            <input
              checked={card.validationRules.runBuild}
              type="checkbox"
              onChange={(event) =>
                onUpdateCard(card.id, { validationRules: { ...card.validationRules, runBuild: event.target.checked } })
              }
            />
            Build validation
          </label>
          <label className="checkbox-row">
            <input
              checked={card.validationRules.runLint}
              type="checkbox"
              onChange={(event) =>
                onUpdateCard(card.id, { validationRules: { ...card.validationRules, runLint: event.target.checked } })
              }
            />
            Lint validation
          </label>
          <label className="checkbox-row">
            <input
              checked={card.validationRules.runTests}
              type="checkbox"
              onChange={(event) =>
                onUpdateCard(card.id, { validationRules: { ...card.validationRules, runTests: event.target.checked } })
              }
            />
            Unit tests
          </label>
          <label className="checkbox-row">
            <input
              checked={card.validationRules.checkFormatting}
              type="checkbox"
              onChange={(event) =>
                onUpdateCard(card.id, { validationRules: { ...card.validationRules, checkFormatting: event.target.checked } })
              }
            />
            Formatting check
          </label>
        </div>
      </section>

      <section className="drawer-section">
        <h3>Project Context</h3>
        <label>
          Repo path
          <input
            value={card.projectContext.repoPath}
            onChange={(event) =>
              onUpdateCard(card.id, { projectContext: { ...card.projectContext, repoPath: event.target.value } })
            }
          />
        </label>
        <label>
          Target files/folders
          <input
            value={card.projectContext.targetPaths}
            onChange={(event) =>
              onUpdateCard(card.id, { projectContext: { ...card.projectContext, targetPaths: event.target.value } })
            }
          />
        </label>
        <div className="two-col-form">
          <label>
            Target files
            <input
              value={card.projectContext.targetFiles}
              onChange={(event) =>
                onUpdateCard(card.id, { projectContext: { ...card.projectContext, targetFiles: event.target.value } })
              }
            />
          </label>
          <label>
            Target folders
            <input
              value={card.projectContext.targetFolders}
              onChange={(event) =>
                onUpdateCard(card.id, { projectContext: { ...card.projectContext, targetFolders: event.target.value } })
              }
            />
          </label>
        </div>
        <label>
          Related documents
          <input
            value={card.projectContext.relatedDocuments}
            onChange={(event) =>
              onUpdateCard(card.id, { projectContext: { ...card.projectContext, relatedDocuments: event.target.value } })
            }
          />
        </label>
        <label>
          Related issue link
          <input
            value={card.projectContext.relatedIssueLink}
            onChange={(event) =>
              onUpdateCard(card.id, { projectContext: { ...card.projectContext, relatedIssueLink: event.target.value } })
            }
          />
        </label>
        <label>
          Extra prompt notes
          <textarea
            rows={3}
            value={card.projectContext.extraPromptNotes}
            onChange={(event) =>
              onUpdateCard(card.id, { projectContext: { ...card.projectContext, extraPromptNotes: event.target.value } })
            }
          />
        </label>
        <label>
          Notes
          <textarea
            rows={4}
            value={card.projectContext.notes}
            onChange={(event) =>
              onUpdateCard(card.id, { projectContext: { ...card.projectContext, notes: event.target.value } })
            }
          />
        </label>
        <div className="repo-meta-row">
          <span>
            {workspace.repoInspection?.versionControlProvider !== "none" && workspace.repoInspection?.currentBranch
              ? `${workspace.repoInspection.versionControlProvider} ${workspace.repoInspection.currentBranch}`
              : "Version control unavailable"}
          </span>
          <span className={workspace.repoInspection?.dirty ? "warning-text" : "success-text"}>
            {workspace.repoInspection?.dirty ? "Dirty repo" : "No dirty repo warning"}
          </span>
        </div>
        <FileTreePicker nodes={workspace.repoInspection?.fileTree ?? []} onAttachFile={attachFile} />
        <button className="empty-action" type="button" onClick={() => onLoadAttachedFiles(card.id)}>
          Load Attached File Context
        </button>
        <label>
          Attached file context
          <textarea
            rows={6}
            value={card.projectContext.attachedFileContext}
            onChange={(event) =>
              onUpdateCard(card.id, {
                projectContext: {
                  ...card.projectContext,
                  attachedFileContext: event.target.value
                }
              })
            }
          />
        </label>
      </section>

      <section className="drawer-section">
        <h3>Safety</h3>
        <div className="checkbox-list">
          {Object.entries(safetyLabels).map(([key, label]) => (
            <label className="checkbox-row" key={key}>
              <input
                checked={card.safetySettings[key as keyof KanbanCard["safetySettings"]]}
                type="checkbox"
                onChange={(event) =>
                  onUpdateCard(card.id, {
                    safetySettings: {
                      ...card.safetySettings,
                      [key]: event.target.checked
                    }
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {card.columnId === "start-implement" || card.columnId === "in-process" ? (
        <section className="drawer-section preview-panel">
          <h3>Execution Preview</h3>
          <pre>{executionPreview}</pre>
          <div className="review-actions">
            {card.columnId === "start-implement" ? (
              <>
                <button type="button" onClick={() => startSession("fresh")}>
                  <Play size={15} />
                  Start Fresh Session
                </button>
                {card.rejectCount > 0 ? (
                  <button type="button" onClick={() => startSession("continue")}>
                    <RotateCcw size={15} />
                    Continue Existing Session
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button type="button" onClick={() => onSimulateExecution(card.id)}>
                  <Play size={15} />
                  Finish Simulation
                </button>
                <button type="button" onClick={() => onCancelExecution(card.id)}>
                  <Undo2 size={15} />
                  Cancel
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {latestSession ? (
        <section className="drawer-section">
          <h3>Active Session</h3>
          <div className="repo-status-grid">
            <span>Session #{latestSession.attemptNumber}</span>
            <span>{latestSession.status}</span>
            <span>{latestSession.retryMode === "continue" ? "Continue" : "Fresh"}</span>
            <span>{latestSession.currentStep}</span>
            <span>Current file: {currentFileLabel(latestSession) || "Unknown"}</span>
            <span>{latestSession.durationSeconds}s</span>
            <span>{latestSession.tokenUsage.totalTokens} tokens</span>
            <span>${latestSession.tokenUsage.costUsd.toFixed(4)}</span>
          </div>
          <div className="usage-summary-grid">
            <span>Provider: {latestSession.providerName || selectedCliTool?.name || selectedModel?.provider || "Unknown"}</span>
            <span>Model: {latestSession.modelName || selectedModel?.modelName || "CLI default"}</span>
            <span>Input: {formatUsageTokens(latestSession.tokenUsage.promptTokens)}</span>
            <span>Output: {formatUsageTokens(latestSession.tokenUsage.completionTokens)}</span>
            <span>Total: {formatUsageTokens(latestSession.tokenUsage.totalTokens)}</span>
            <span>Cost: {formatUsageCost(latestSession.tokenUsage.costUsd, latestSession.usageWasEstimated)}</span>
            <span>Elapsed: {formatUsageDuration(latestSession.durationSeconds * 1000)}</span>
            <span>Tokens/min: {formatTokensPerMinute(latestSession.tokenUsage.totalTokens, latestSession.durationSeconds)}</span>
          </div>
          <div className="repo-status-grid">
            {latestSession.validationResults.map((result) => (
              <span className={result.status === "failed" ? "warning-text" : result.status === "passed" ? "success-text" : ""} key={result.id}>
                {result.name}: {result.status}
              </span>
            ))}
          </div>
          <div className="log-list">
            {latestSession.logs
              .slice()
              .reverse()
              .map((entry) => (
                <div className={`log-entry ${entry.level}`} key={entry.id}>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  <p>{entry.message}</p>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {card.columnId !== "done" ? (
      <section className="drawer-section preview-panel">
        <h3>Final Prompt Preview</h3>
        <pre>{generatedPrompt.finalPromptPreview}</pre>
      </section>
      ) : null}

      {card.columnId === "in-review" ? (
      <section className="drawer-section">
        <h3>Review</h3>
        <div className="checkbox-list">
          {Object.entries(checklistLabels).map(([key, label]) => (
            <label className="checkbox-row" key={key}>
              <input
                checked={card.reviewChecklist[key as keyof KanbanCard["reviewChecklist"]]}
                type="checkbox"
                onChange={(event) =>
                  onUpdateCard(card.id, {
                    reviewChecklist: {
                      ...card.reviewChecklist,
                      [key]: event.target.checked
                    }
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>

        {card.columnId === "in-review" ? (
          <div className="review-actions">
            <button type="button" onClick={() => onReviewAction(card.id, "approve")}>
              <ShieldCheck size={15} />
              Approve
            </button>
            <button type="button" onClick={() => onReviewAction(card.id, "request-changes")}>
              <Undo2 size={15} />
              Reject
            </button>
          </div>
        ) : null}
      </section>
      ) : null}

      <section className="drawer-section">
        <h3>Result</h3>
        <label>
          Summary
          <textarea
            rows={4}
            readOnly={card.columnId === "done"}
            value={latestSession?.summary || card.resultSummary}
            onChange={(event) => onUpdateCard(card.id, { resultSummary: event.target.value })}
          />
        </label>
        <label>
          Patch text
          <textarea
            rows={6}
            readOnly={card.columnId === "done"}
            value={card.patchText || latestSession?.diffText || card.diffPlaceholder}
            onChange={(event) => onUpdateCard(card.id, { patchText: event.target.value })}
          />
        </label>
        <DiffViewer value={card.patchText || latestSession?.diffText || card.diffPlaceholder} />
        {card.columnId === "in-review" ? (
        <>
        <label>
          Commit message
          <input value={card.commitMessage} onChange={(event) => onUpdateCard(card.id, { commitMessage: event.target.value })} />
        </label>
        <label>
          PR title
          <input value={card.prTitle} onChange={(event) => onUpdateCard(card.id, { prTitle: event.target.value })} />
        </label>
        <label>
          PR description
          <textarea
            rows={5}
            value={card.prDescription}
            onChange={(event) => onUpdateCard(card.id, { prDescription: event.target.value })}
          />
        </label>
        </>
        ) : null}
        {card.columnId === "in-review" ? (
        <>
        <label>
          PR URL
          <input value={card.prUrl} onChange={(event) => onUpdateCard(card.id, { prUrl: event.target.value })} />
        </label>
        <label>
          Test output
          <textarea
            rows={4}
            value={card.testOutput}
            onChange={(event) => onUpdateCard(card.id, { testOutput: event.target.value })}
          />
        </label>
        <label>
          Build output
          <textarea
            rows={4}
            value={card.buildOutput}
            onChange={(event) => onUpdateCard(card.id, { buildOutput: event.target.value })}
          />
        </label>
        <label>
          Apply output
          <textarea
            rows={3}
            value={card.applyOutput}
            onChange={(event) => onUpdateCard(card.id, { applyOutput: event.target.value })}
          />
        </label>
        </>
        ) : null}
      </section>

      <section className="drawer-section">
        <h3>Activity Log</h3>
        <div className="log-list">
          {card.activityLog
            .slice()
            .reverse()
            .map((entry) => (
              <div className={`log-entry ${entry.level}`} key={entry.id}>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                <p>{entry.message}</p>
              </div>
          ))}
        </div>
      </section>

      <section className="drawer-section">
        <h3>Session History</h3>
        <div className="log-list">
          {card.sessions
            .slice()
            .reverse()
            .map((session) => (
              <div className={`log-entry ${session.status === "approved" ? "success" : session.status === "rejected" || session.status === "failed" ? "warning" : "info"}`} key={session.id}>
                <span>
                  Session #{session.attemptNumber} / {session.status} / {session.retryMode}
                </span>
                <p>{session.summary || session.currentStep}</p>
                <p>
                  {session.providerName || "Provider unknown"} / {formatUsageTokens(session.tokenUsage.totalTokens)} tokens /{" "}
                  {formatUsageCost(session.tokenUsage.costUsd, session.usageWasEstimated)}
                </p>
              </div>
            ))}
          {card.sessions.length === 0 ? <p className="helper-text">No implementation sessions yet.</p> : null}
        </div>
      </section>

      <footer className="drawer-meta">
        Created {new Date(card.createdAt).toLocaleString()} / Updated {new Date(card.updatedAt).toLocaleString()}
      </footer>
      </div>
      </section>
    </div>
  );
};

const splitList = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatUsageTokens = (tokens: number) => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
};

const formatUsageCost = (cost: number, estimated?: boolean) => {
  const prefix = estimated ? "~" : "";
  return `${prefix}$${cost.toFixed(cost < 0.01 ? 4 : 2)}`;
};

const formatUsageDuration = (durationMs: number) => {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatTokensPerMinute = (tokens: number, durationSeconds: number) => {
  if (durationSeconds <= 0) {
    return "0";
  }
  return formatUsageTokens(Math.round(tokens / (durationSeconds / 60)));
};

const currentFileLabel = (session: { changedFiles: string[]; currentStep: string; logs: Array<{ message: string }> }) => {
  if (session.changedFiles[0]) {
    return session.changedFiles[0];
  }
  const text = [session.currentStep, session.logs.at(-1)?.message ?? ""].join(" ");
  return text.match(/[A-Za-z0-9_\-./\\]+\.(?:ts|tsx|js|jsx|json|css|scss|md|cjs|mjs|cs|py|html|yml|yaml)/)?.[0] ?? "";
};
