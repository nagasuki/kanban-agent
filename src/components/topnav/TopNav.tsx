import { Bell, Bot, Database, Settings } from "lucide-react";
import type { Workspace } from "../../domain/types";

interface TopNavProps {
  activeWorkspace: Workspace;
  onOpenSettings: () => void;
}

export const TopNav = ({ activeWorkspace, onOpenSettings }: TopNavProps) => {
  const currentModel = activeWorkspace.modelProfiles.find((model) => model.id === activeWorkspace.defaultModelProfileId);

  return (
    <header className="app-navbar">
      <div className="nav-brand">
        <Database size={19} />
        <strong>kanban-agent</strong>
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
