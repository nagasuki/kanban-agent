import { Bell, Bot, Database, Search, Settings } from "lucide-react";
import type { Workspace } from "../../domain/types";

interface TopNavProps {
  activeWorkspace: Workspace;
  onOpenSettings: () => void;
  onSearch: (value: string) => void;
  searchQuery: string;
  workspaces: Workspace[];
  onSelectWorkspace: (workspaceId: string) => void;
}

export const TopNav = ({
  activeWorkspace,
  onOpenSettings,
  onSearch,
  searchQuery,
  workspaces,
  onSelectWorkspace
}: TopNavProps) => {
  const currentModel = activeWorkspace.modelProfiles.find((model) => model.id === activeWorkspace.defaultModelProfileId);

  return (
    <header className="app-navbar">
      <div className="nav-brand">
        <Database size={19} />
        <strong>kanban-agent</strong>
      </div>

      <div className="nav-center">
        <select
          aria-label="Workspace selector"
          className="nav-workspace-select"
          value={activeWorkspace.id}
          onChange={(event) => onSelectWorkspace(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <label className="nav-search">
          <Search size={15} />
          <input
            aria-label="Search cards"
            placeholder="Search cards"
            value={searchQuery}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="nav-actions">
        <button aria-label="Notifications" className="icon-button" title="Notifications" type="button">
          <Bell size={16} />
        </button>
        <span className="model-indicator">
          <Bot size={14} />
          {currentModel?.modelName ?? "No model"}
        </span>
        <button aria-label="Settings" className="icon-button" title="Settings" type="button" onClick={onOpenSettings}>
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
