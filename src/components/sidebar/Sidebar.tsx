import { Database, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AgentProfile, AppState, ModelProfile, SkillPreset, Workspace } from "../../domain/types";
import { AgentEditor } from "../agents/AgentEditor";
import { ModelEditor } from "../models/ModelEditor";
import { SkillEditor } from "../skills/SkillEditor";
import { RepoStatusPanel } from "../workspace/RepoStatusPanel";

interface SidebarProps {
  state: AppState;
  activeWorkspace: Workspace;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onInspectRepo: () => void;
  onSelectRepoFolder: () => void;
  onUpdateWorkspace: (updates: Partial<Workspace>) => void;
  onReset: () => void;
  onCreateSkill: () => void;
  onUpdateSkill: (skillId: string, updates: Partial<SkillPreset>) => void;
  onDuplicateSkill: (skillId: string) => void;
  onDeleteSkill: (skillId: string) => void;
  onCreateModel: () => void;
  onUpdateModel: (modelId: string, updates: Partial<ModelProfile>) => void;
  onDeleteModel: (modelId: string) => void;
  onCreateAgent: () => void;
  onUpdateAgent: (agentId: string, updates: Partial<AgentProfile>) => void;
  onDeleteAgent: (agentId: string) => void;
}

type SidebarTab = "workspace" | "skills" | "models" | "agents";

export const Sidebar = ({
  state,
  activeWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  onInspectRepo,
  onSelectRepoFolder,
  onUpdateWorkspace,
  onReset,
  onCreateSkill,
  onUpdateSkill,
  onDuplicateSkill,
  onDeleteSkill,
  onCreateModel,
  onUpdateModel,
  onDeleteModel,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent
}: SidebarProps) => {
  const [tab, setTab] = useState<SidebarTab>("workspace");

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <Database size={20} />
        <div>
          <strong>kanban-agent</strong>
          <span>Local prototype</span>
        </div>
      </div>

      <nav className="segmented" aria-label="Sidebar sections">
        <button className={tab === "workspace" ? "active" : ""} type="button" onClick={() => setTab("workspace")}>
          Workspace
        </button>
        <button className={tab === "skills" ? "active" : ""} type="button" onClick={() => setTab("skills")}>
          Skills
        </button>
        <button className={tab === "models" ? "active" : ""} type="button" onClick={() => setTab("models")}>
          Models
        </button>
        <button className={tab === "agents" ? "active" : ""} type="button" onClick={() => setTab("agents")}>
          Agents
        </button>
      </nav>

      {tab === "workspace" ? (
        <div className="sidebar-section">
          <div className="section-title-row">
            <h2>Projects</h2>
            <button className="icon-button" title="Create workspace" type="button" onClick={onCreateWorkspace}>
              <Plus size={16} />
            </button>
          </div>

          <div className="workspace-list">
            {state.workspaces.map((workspace) => (
              <div className={`workspace-item ${workspace.id === activeWorkspace.id ? "active" : ""}`} key={workspace.id}>
                <button type="button" onClick={() => onSelectWorkspace(workspace.id)}>
                  <strong>{workspace.name}</strong>
                  <span>{workspace.cards.length} cards</span>
                </button>
                <button
                  className="icon-button danger"
                  disabled={state.workspaces.length === 1}
                  title="Delete workspace"
                  type="button"
                  onClick={() => onDeleteWorkspace(workspace.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <label>
            Workspace name
            <input value={activeWorkspace.name} onChange={(event) => onUpdateWorkspace({ name: event.target.value })} />
          </label>
          <label>
            Repo path
            <input
              value={activeWorkspace.repoPath}
              onChange={(event) => onUpdateWorkspace({ repoPath: event.target.value })}
              placeholder="D:\project"
            />
          </label>
          <RepoStatusPanel
            inspection={activeWorkspace.repoInspection}
            onRefresh={onInspectRepo}
            onSelectFolder={onSelectRepoFolder}
          />
          <label>
            Default branch
            <input
              value={activeWorkspace.defaultBranch}
              onChange={(event) => onUpdateWorkspace({ defaultBranch: event.target.value })}
              placeholder="main"
            />
          </label>
          <label>
            Default model
            <select
              value={activeWorkspace.defaultModelProfileId}
              onChange={(event) => onUpdateWorkspace({ defaultModelProfileId: event.target.value })}
            >
              <option value="">No default model</option>
              {activeWorkspace.modelProfiles.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Default agent
            <select
              value={activeWorkspace.defaultAgentProfileId}
              onChange={(event) => onUpdateWorkspace({ defaultAgentProfileId: event.target.value })}
            >
              <option value="">No default agent</option>
              {activeWorkspace.agentProfiles.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Allowed editable folders
            <input
              value={activeWorkspace.allowedEditableFolders}
              onChange={(event) => onUpdateWorkspace({ allowedEditableFolders: event.target.value })}
              placeholder="src, tests"
            />
          </label>
          <label>
            Blocked file patterns
            <input
              value={activeWorkspace.blockedFilePatterns}
              onChange={(event) => onUpdateWorkspace({ blockedFilePatterns: event.target.value })}
              placeholder=".env, *.pem"
            />
          </label>
          <label>
            Test command
            <input
              value={activeWorkspace.testCommand}
              onChange={(event) => onUpdateWorkspace({ testCommand: event.target.value })}
              placeholder="npm test"
            />
          </label>
          <label>
            Build command
            <input
              value={activeWorkspace.buildCommand}
              onChange={(event) => onUpdateWorkspace({ buildCommand: event.target.value })}
              placeholder="npm run build"
            />
          </label>

          <button className="danger-text-button" type="button" onClick={onReset}>
            <RotateCcw size={15} />
            Reset seed data
          </button>
        </div>
      ) : null}

      {tab === "skills" ? (
        <div className="sidebar-section">
          <div className="section-title-row">
            <h2>Skill Presets</h2>
            <button className="icon-button" title="Create skill" type="button" onClick={onCreateSkill}>
              <Plus size={16} />
            </button>
          </div>
          <div className="editor-stack">
            {activeWorkspace.skills.map((skill) => (
              <SkillEditor
                key={skill.id}
                skill={skill}
                onUpdate={(updates) => onUpdateSkill(skill.id, updates)}
                onDuplicate={() => onDuplicateSkill(skill.id)}
                onDelete={() => onDeleteSkill(skill.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {tab === "models" ? (
        <div className="sidebar-section">
          <div className="section-title-row">
            <h2>Model Profiles</h2>
            <button className="icon-button" title="Create model profile" type="button" onClick={onCreateModel}>
              <Plus size={16} />
            </button>
          </div>
          <div className="editor-stack">
            {activeWorkspace.modelProfiles.map((model) => (
              <ModelEditor
                key={model.id}
                model={model}
                onUpdate={(updates) => onUpdateModel(model.id, updates)}
                onDelete={() => onDeleteModel(model.id)}
              />
            ))}
          </div>
          {activeWorkspace.modelProfiles.length === 0 ? (
            <button className="empty-action" type="button" onClick={onCreateModel}>
              <Plus size={16} />
              Add the first model profile
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === "agents" ? (
        <div className="sidebar-section">
          <div className="section-title-row">
            <h2>Agent Profiles</h2>
            <button className="icon-button" title="Create agent profile" type="button" onClick={onCreateAgent}>
              <Plus size={16} />
            </button>
          </div>
          <div className="editor-stack">
            {activeWorkspace.agentProfiles.map((agent) => (
              <AgentEditor
                agent={agent}
                key={agent.id}
                workspace={activeWorkspace}
                onUpdate={(updates) => onUpdateAgent(agent.id, updates)}
                onDelete={() => onDeleteAgent(agent.id)}
              />
            ))}
          </div>
          {activeWorkspace.agentProfiles.length === 0 ? (
            <button className="empty-action" type="button" onClick={onCreateAgent}>
              <Plus size={16} />
              Add the first agent profile
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="sidebar-footer">
        <Trash2 size={14} />
        Board state is local. Secrets use Electron secure storage.
      </div>
    </aside>
  );
};
