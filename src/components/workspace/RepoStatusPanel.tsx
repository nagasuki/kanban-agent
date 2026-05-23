import { GitBranch, RefreshCw, Search } from "lucide-react";
import type { RepoInspection } from "../../domain/types";

interface RepoStatusPanelProps {
  inspection: RepoInspection | undefined;
  onRefresh: () => void;
  onSelectFolder: () => void;
}

export const RepoStatusPanel = ({ inspection, onRefresh, onSelectFolder }: RepoStatusPanelProps) => {
  return (
    <section className="repo-panel">
      <div className="button-row">
        <button type="button" onClick={onSelectFolder}>
          <Search size={15} />
          Select Repo
        </button>
        <button type="button" onClick={onRefresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {inspection ? (
        <div className="repo-status-grid">
          <span>
            <GitBranch size={14} />
            {inspection.isGitRepo ? inspection.currentBranch : "Not a Git repo"}
          </span>
          <span className={inspection.dirty ? "warning-text" : "success-text"}>
            {inspection.dirty ? "Dirty" : "Clean"}
          </span>
          <span>{inspection.changedFiles.length} changed files</span>
          <span>{new Date(inspection.scannedAt).toLocaleTimeString()}</span>
        </div>
      ) : (
        <p className="helper-text">Select or refresh a repo to inspect files and Git status.</p>
      )}

      {inspection?.warnings.length ? (
        <div className="warning-stack">
          {inspection.warnings.map((warning) => (
            <p className="helper-text warning-text" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
};
