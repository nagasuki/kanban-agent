import { GitBranch, RefreshCw, Search } from "lucide-react";
import type { RepoInspection } from "../../domain/types";
import { BranchSelect } from "./BranchSelect";

interface RepoStatusPanelProps {
  inspection: RepoInspection | undefined;
  onRefresh: () => void;
  onSelectFolder: () => void;
  onSwitchBranch: (branch: string) => void;
}

export const RepoStatusPanel = ({ inspection, onRefresh, onSelectFolder, onSwitchBranch }: RepoStatusPanelProps) => {
  const branchOptions =
    inspection && inspection.currentBranch && !inspection.branches.includes(inspection.currentBranch)
      ? [inspection.currentBranch, ...inspection.branches]
      : inspection?.branches ?? [];
  const hasBranches = branchOptions.length > 0;

  return (
    <section className="repo-panel">
      <div className="button-row">
        <button type="button" onClick={onSelectFolder}>
          <Search size={15} />
          Select Project Path
        </button>
        <button type="button" onClick={onRefresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {inspection ? (
        <>
          <div className="repo-status-grid">
            <span>
              <GitBranch size={14} />
              {labelForProvider(inspection.versionControlProvider)}
            </span>
            <span>{inspection.currentBranch || "No branch"}</span>
            <span className={inspection.dirty ? "warning-text" : "success-text"}>
              {inspection.dirty ? "Dirty" : "Clean"}
            </span>
            <span>{inspection.changedFiles.length} changed files</span>
            <span>{new Date(inspection.scannedAt).toLocaleTimeString()}</span>
          </div>

          <BranchSelect
            branches={branchOptions}
            disabled={!hasBranches}
            value={inspection.currentBranch}
            onChange={(branch) => {
              if (branch && branch !== inspection.currentBranch) {
                onSwitchBranch(branch);
              }
            }}
          />
        </>
      ) : (
        <p className="helper-text">Select a project folder to auto-detect Git or Plastic, branches, files, and status.</p>
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

const labelForProvider = (provider: RepoInspection["versionControlProvider"]) => {
  if (provider === "git") return "Git";
  if (provider === "plastic") return "Plastic";
  return "No version control";
};
