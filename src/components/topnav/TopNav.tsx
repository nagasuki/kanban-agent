import { useEffect, useState } from "react";
import { Bell, Bot, Database, RefreshCw, Settings } from "lucide-react";
import type { Workspace } from "../../domain/types";

interface TopNavProps {
  activeWorkspace: Workspace;
  onOpenSettings: () => void;
}

export const TopNav = ({ activeWorkspace, onOpenSettings }: TopNavProps) => {
  const currentModel = activeWorkspace.modelProfiles.find((model) => model.id === activeWorkspace.defaultModelProfileId);
  const [updateInfo, setUpdateInfo] = useState({
    checkedAt: "",
    currentVersion: "0.0.0",
    latestVersion: "",
    updateAvailable: false,
    downloadUrl: "",
    message: "Update check has not run yet."
  });
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const checkUpdate = async () => {
    if (!window.kanbanAgent?.updates) {
      return;
    }
    setCheckingUpdate(true);
    try {
      setUpdateInfo(await window.kanbanAgent.updates.check());
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadUpdateInfo = async () => {
      if (!window.kanbanAgent?.updates) {
        return;
      }
      const info = await window.kanbanAgent.updates.getInfo();
      if (mounted) {
        setUpdateInfo(info);
      }
      const checkedRecently = info.checkedAt && Date.now() - new Date(info.checkedAt).getTime() < 10_000;
      if (!checkedRecently) {
        const checked = await window.kanbanAgent.updates.check();
        if (mounted) {
          setUpdateInfo(checked);
        }
      }
    };
    void loadUpdateInfo();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="app-navbar">
      <div className="nav-brand">
        <Database size={19} />
        <strong>kanban-agent</strong>
        <span className={updateInfo.updateAvailable ? "version-badge update" : "version-badge"}>
          v{updateInfo.currentVersion}
        </span>
        <button
          className={updateInfo.updateAvailable ? "update-button available" : "update-button"}
          disabled={checkingUpdate}
          title={updateInfo.message}
          type="button"
          onClick={checkUpdate}
        >
          <RefreshCw size={13} />
          {checkingUpdate ? "Checking..." : updateInfo.updateAvailable ? `Update ${updateInfo.latestVersion}` : "Check update"}
        </button>
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
