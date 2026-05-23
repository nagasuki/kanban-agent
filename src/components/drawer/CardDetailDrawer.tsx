import { Copy, PanelRightClose, Play, RotateCcw, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { BOARD_COLUMNS, EXECUTION_MODES } from "../../domain/constants";
import { buildExecutionPreview } from "../../domain/executionService";
import { buildAgentPrompt } from "../../domain/promptBuilder";
import type { BoardColumnId, KanbanCard, Workspace } from "../../domain/types";
import { DiffViewer } from "../diff/DiffViewer";
import { FileTreePicker } from "./FileTreePicker";

interface CardDetailDrawerProps {
  card: KanbanCard | undefined;
  workspace: Workspace;
  onClose: () => void;
  onUpdateCard: (cardId: string, updates: Partial<KanbanCard>) => void;
  onDeleteCard: (cardId: string) => void;
  onDuplicateCard: (cardId: string) => void;
  onReviewAction: (cardId: string, action: "approve" | "request-changes" | "retry" | "rollback") => void;
  onSimulateExecution: (cardId: string) => void;
  onCancelExecution: (cardId: string) => void;
  onRunPlanOnly: (cardId: string) => void;
  onLoadAttachedFiles: (cardId: string) => void;
  onRunCliAgent: (cardId: string) => void;
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

export const CardDetailDrawer = ({
  card,
  workspace,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
  onReviewAction,
  onSimulateExecution,
  onCancelExecution,
  onRunPlanOnly,
  onLoadAttachedFiles,
  onRunCliAgent,
  onApplyPatch,
  onRunWorkspaceCommand,
  onCommit,
  onGeneratePrDraft,
  onRollbackFiles,
  onCreatePr
}: CardDetailDrawerProps) => {
  if (!card) {
    return <aside className="drawer drawer-empty">Select a card to inspect the agent context.</aside>;
  }

  const selectedSkills = workspace.skills.filter((skill) => card.skillIds.includes(skill.id));
  const selectedModel = workspace.modelProfiles.find((model) => model.id === card.modelProfileId);
  const selectedAgent = workspace.agentProfiles.find((agent) => agent.id === card.agentProfileId);
  const executionPreview = buildExecutionPreview(card, selectedModel, selectedSkills);
  const generatedPrompt = buildAgentPrompt(card, workspace, selectedModel, selectedSkills, selectedAgent);
  const applyAgentProfile = (agentId: string) => {
    const agent = workspace.agentProfiles.find((profile) => profile.id === agentId);
    onUpdateCard(
      card.id,
      agent
        ? {
            agentProfileId: agent.id,
            skillIds: agent.skillIds,
            modelProfileId: agent.defaultModelProfileId,
            executionMode: agent.defaultExecutionMode
          }
        : { agentProfileId: undefined }
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
    <aside className="drawer">
      <header className="drawer-header">
        <div>
          <p className="eyebrow">{BOARD_COLUMNS.find((column) => column.id === card.columnId)?.title}</p>
          <h2>{card.title}</h2>
        </div>
        <button className="icon-button" title="Close details" type="button" onClick={onClose}>
          <PanelRightClose size={18} />
        </button>
      </header>

      <div className="drawer-actions">
        <button type="button" onClick={() => onRunCliAgent(card.id)}>
          <Play size={15} />
          Run CLI Agent
        </button>
        {card.locked ? <span className="status-pill warning-text">Locked</span> : null}
        <button type="button" onClick={() => onApplyPatch(card.id)}>
          <Play size={15} />
          Apply Patch
        </button>
        <button type="button" onClick={() => onDuplicateCard(card.id)}>
          <Copy size={15} />
          Duplicate
        </button>
        <button className="danger-text-button" type="button" onClick={() => onDeleteCard(card.id)}>
          <Trash2 size={15} />
          Delete
        </button>
      </div>

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

      <section className="drawer-section">
        <h3>Agent Context</h3>
        <div className="checkbox-list">
          {workspace.skills.map((skill) => (
            <label className="checkbox-row" key={skill.id}>
              <input
                checked={card.skillIds.includes(skill.id)}
                type="checkbox"
                onChange={(event) => {
                  const nextSkillIds = event.target.checked
                    ? [...card.skillIds, skill.id]
                    : card.skillIds.filter((id) => id !== skill.id);
                  onUpdateCard(card.id, { skillIds: nextSkillIds });
                }}
              />
              {skill.name}
            </label>
          ))}
        </div>

        <label>
          Agent profile
          <select
            value={card.agentProfileId ?? ""}
            onChange={(event) => applyAgentProfile(event.target.value)}
          >
            <option value="">No agent selected</option>
            {workspace.agentProfiles.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Model profile
          <select value={card.modelProfileId} onChange={(event) => onUpdateCard(card.id, { modelProfileId: event.target.value })}>
            <option value="">No model selected</option>
            {workspace.modelProfiles.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>

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
          <span>{workspace.repoInspection?.isGitRepo ? `Branch ${workspace.repoInspection.currentBranch}` : "Git status unavailable"}</span>
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
            <button type="button" onClick={() => onRunPlanOnly(card.id)}>
              <Play size={15} />
              Run Plan Only
            </button>
            <button type="button" onClick={() => onRunCliAgent(card.id)}>
              <Play size={15} />
              Run CLI Agent
            </button>
            <button type="button" onClick={() => onSimulateExecution(card.id)}>
              <Play size={15} />
              {card.columnId === "in-process" ? "Finish Simulation" : "Start Simulation"}
            </button>
            <button type="button" onClick={() => onCancelExecution(card.id)}>
              <Undo2 size={15} />
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section className="drawer-section preview-panel">
        <h3>Final Prompt Preview</h3>
        <pre>{generatedPrompt.finalPromptPreview}</pre>
      </section>

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

        <div className="review-actions">
          <button type="button" onClick={() => onReviewAction(card.id, "approve")}>
            <ShieldCheck size={15} />
            Approve
          </button>
          <button type="button" onClick={() => onReviewAction(card.id, "request-changes")}>
            <Undo2 size={15} />
            Request Changes
          </button>
          <button type="button" onClick={() => onReviewAction(card.id, "retry")}>
            <RotateCcw size={15} />
            Retry
          </button>
          <button type="button" onClick={() => onReviewAction(card.id, "rollback")}>
            <Play size={15} />
            Rollback
          </button>
        </div>
      </section>

      <section className="drawer-section">
        <h3>Result</h3>
        <label>
          Summary
          <textarea
            rows={4}
            value={card.resultSummary}
            onChange={(event) => onUpdateCard(card.id, { resultSummary: event.target.value })}
          />
        </label>
        <label>
          Patch text
          <textarea
            rows={6}
            value={card.patchText || card.diffPlaceholder}
            onChange={(event) => onUpdateCard(card.id, { patchText: event.target.value })}
          />
        </label>
        <DiffViewer value={card.patchText || card.diffPlaceholder} />
        <div className="review-actions">
          <button type="button" onClick={() => onRunWorkspaceCommand(card.id, "test")}>
            <Play size={15} />
            Run Test
          </button>
          <button type="button" onClick={() => onRunWorkspaceCommand(card.id, "build")}>
            <Play size={15} />
            Run Build
          </button>
          <button type="button" onClick={() => onCommit(card.id)}>
            <Play size={15} />
          Commit
          </button>
          <button type="button" onClick={() => onGeneratePrDraft(card.id)}>
            <Play size={15} />
            Draft PR
          </button>
          <button type="button" onClick={() => onCreatePr(card.id)}>
            <Play size={15} />
            Create PR
          </button>
          <button type="button" onClick={() => onRollbackFiles(card.id)}>
            <Undo2 size={15} />
            Rollback Files
          </button>
        </div>
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

      <footer className="drawer-meta">
        Created {new Date(card.createdAt).toLocaleString()} · Updated {new Date(card.updatedAt).toLocaleString()}
      </footer>
    </aside>
  );
};

const splitList = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
