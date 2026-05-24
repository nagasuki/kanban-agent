import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ThemeMode } from "../../app/theme";
import type { AgentProfile, AppState, CliToolProfile, ModelProfile, SkillPreset, Workspace } from "../../domain/types";
import { AgentEditor } from "../agents/AgentEditor";
import { CliToolEditor } from "../cli/CliToolEditor";
import { ModelEditor } from "../models/ModelEditor";
import { SkillEditor } from "../skills/SkillEditor";
import { RepoStatusPanel } from "../workspace/RepoStatusPanel";

interface SettingsModalProps {
  activeWorkspace: Workspace;
  state: AppState;
  onClose: () => void;
  onCreateAgent: () => void;
  onCreateCliTool: () => void;
  onCreateModel: () => void;
  onCreateSkill: () => void;
  onCreateWorkspace: () => void | Promise<void>;
  onDeleteAgent: (agentId: string) => void;
  onDeleteCliTool: (profileId: string) => void;
  onDeleteModel: (modelId: string) => void;
  onDeleteSkill: (skillId: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDuplicateSkill: (skillId: string) => void;
  onInspectRepo: () => void;
  onReset: () => void;
  onSelectRepoFolder: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onSwitchBranch: (branch: string) => void;
  onThemeChange: (mode: ThemeMode) => void;
  onUpdateAgent: (agentId: string, updates: Partial<AgentProfile>) => void;
  onUpdateCliTool: (profileId: string, updates: Partial<CliToolProfile>) => void;
  onUpdateModel: (modelId: string, updates: Partial<ModelProfile>) => void;
  onUpdateSkill: (skillId: string, updates: Partial<SkillPreset>) => void;
  onUpdateWorkspace: (updates: Partial<Workspace>) => void;
  themeMode: ThemeMode;
}

type SettingsCategory =
  | "Workspace"
  | "Skill Presets"
  | "AI Models"
  | "CLI Agents"
  | "Agent Profiles"
  | "Execution Rules"
  | "Sandbox & Safety"
  | "Version Control"
  | "Appearance"
  | "Logs"
  | "Experimental";

const categories: SettingsCategory[] = [
  "Workspace",
  "Skill Presets",
  "AI Models",
  "CLI Agents",
  "Agent Profiles",
  "Execution Rules",
  "Sandbox & Safety",
  "Version Control",
  "Appearance",
  "Logs",
  "Experimental"
];

const themeOptions: Array<{ mode: ThemeMode; title: string; description: string }> = [
  { mode: "dark", title: "Dark Mode", description: "Low-strain developer workspace." },
  { mode: "light", title: "Light Mode", description: "Soft, bright interface for daytime work." },
  { mode: "system", title: "System Default", description: "Follow your operating system theme." }
];

export const SettingsModal = (props: SettingsModalProps) => {
  const [category, setCategory] = useState<SettingsCategory>("Workspace");

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section
        aria-label="Settings"
        aria-modal="true"
        className="settings-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="settings-sidebar">
          <div className="settings-title-row">
            <h2>Settings</h2>
            <button className="icon-button" title="Close settings" type="button" onClick={props.onClose}>
              <X size={16} />
            </button>
          </div>
          <nav className="settings-nav">
            {categories.map((item) => (
              <button className={category === item ? "active" : ""} key={item} type="button" onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className="settings-panel">
          {category === "Workspace" ? <WorkspaceSettings {...props} /> : null}
          {category === "Skill Presets" ? <SkillSettings {...props} /> : null}
          {category === "AI Models" ? <ModelSettings {...props} /> : null}
          {category === "CLI Agents" ? <CliSettings {...props} /> : null}
          {category === "Agent Profiles" ? <AgentSettings {...props} /> : null}
          {category === "Appearance" ? <AppearanceSettings {...props} /> : null}
          {category === "Execution Rules" ? <PlaceholderSettings title="Execution Rules" /> : null}
          {category === "Sandbox & Safety" ? <PlaceholderSettings title="Sandbox & Safety" /> : null}
          {category === "Version Control" ? <PlaceholderSettings title="Version Control" /> : null}
          {category === "Logs" ? <PlaceholderSettings title="Logs" /> : null}
          {category === "Experimental" ? <PlaceholderSettings title="Experimental" /> : null}
        </main>
      </section>
    </div>
  );
};

const WorkspaceSettings = ({
  activeWorkspace,
  state,
  onCreateWorkspace,
  onDeleteWorkspace,
  onInspectRepo,
  onReset,
  onSelectRepoFolder,
  onSelectWorkspace,
  onSwitchBranch,
  onUpdateWorkspace
}: SettingsModalProps) => {
  const branchOptions =
    activeWorkspace.repoInspection?.branches.includes(activeWorkspace.defaultBranch)
      ? activeWorkspace.repoInspection.branches
      : [activeWorkspace.defaultBranch, ...(activeWorkspace.repoInspection?.branches ?? [])].filter(Boolean);

  return (
  <>
    <PanelHeader
      eyebrow="Workspace"
      title="Project Workspace"
      description="Manage projects, repo paths, defaults, commands, and local seed data."
    />

    <div className="settings-section">
      <div className="section-title-row">
        <h4>Projects</h4>
        <button className="icon-button" title="Add project from folder" type="button" onClick={onCreateWorkspace}>
          <Plus size={16} />
        </button>
      </div>
      <button className="empty-action settings-inline-action" type="button" onClick={onCreateWorkspace}>
        <Plus size={16} />
        Add Project from Folder
      </button>
      <div className="workspace-list settings-list">
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
    </div>

    <div className="settings-form-grid">
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
      <label>
        Version control
        <select
          value={activeWorkspace.versionControlProvider}
          onChange={(event) =>
            onUpdateWorkspace({ versionControlProvider: event.target.value as Workspace["versionControlProvider"] })
          }
        >
          <option value="auto">Auto detect</option>
          <option value="git">Git</option>
          <option value="plastic">Plastic / Unity Version Control</option>
        </select>
      </label>
    </div>

    <RepoStatusPanel
      inspection={activeWorkspace.repoInspection}
      onRefresh={onInspectRepo}
      onSelectFolder={onSelectRepoFolder}
      onSwitchBranch={onSwitchBranch}
    />

    <div className="settings-form-grid">
      <label>
        Branch
        <select
          value={activeWorkspace.defaultBranch}
          onChange={(event) => {
            const branch = event.target.value;
            onUpdateWorkspace({ defaultBranch: branch });
            if (branch && branch !== activeWorkspace.repoInspection?.currentBranch) {
              onSwitchBranch(branch);
            }
          }}
        >
          <option value={activeWorkspace.defaultBranch || ""}>
            {activeWorkspace.defaultBranch || "No branch detected"}
          </option>
          {branchOptions
            .filter((branch, index, options) => options.indexOf(branch) === index && branch !== activeWorkspace.defaultBranch)
            .map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
        </select>
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
        Default CLI
        <select
          value={activeWorkspace.defaultCliToolProfileId}
          onChange={(event) => onUpdateWorkspace({ defaultCliToolProfileId: event.target.value })}
        >
          <option value="">No default CLI</option>
          {activeWorkspace.cliToolProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
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
    </div>

    <button className="danger-text-button settings-inline-action" type="button" onClick={onReset}>
      <RotateCcw size={15} />
      Reset seed data
    </button>
  </>
  );
};

const SkillSettings = ({ activeWorkspace, onCreateSkill, onDeleteSkill, onDuplicateSkill, onUpdateSkill }: SettingsModalProps) => (
  <>
    <PanelHeader eyebrow="Skill Presets" title="Skill Presets" description="Create, edit, duplicate, and delete reusable skill.md profiles." />
    <button className="empty-action settings-inline-action" type="button" onClick={onCreateSkill}>
      <Plus size={16} />
      Add skill preset
    </button>
    <div className="editor-stack settings-editor-stack">
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
  </>
);

const ModelSettings = ({ activeWorkspace, onCreateModel, onDeleteModel, onUpdateModel }: SettingsModalProps) => (
  <>
    <PanelHeader eyebrow="AI Models" title="Model Profiles" description="Configure provider, model, endpoint placeholders, and secure API keys." />
    <button className="empty-action settings-inline-action" type="button" onClick={onCreateModel}>
      <Plus size={16} />
      Add model profile
    </button>
    <div className="editor-stack settings-editor-stack">
      {activeWorkspace.modelProfiles.map((model) => (
        <ModelEditor
          key={model.id}
          model={model}
          onUpdate={(updates) => onUpdateModel(model.id, updates)}
          onDelete={() => onDeleteModel(model.id)}
        />
      ))}
    </div>
  </>
);

const CliSettings = ({ activeWorkspace, onCreateCliTool, onDeleteCliTool, onUpdateCliTool }: SettingsModalProps) => (
  <>
    <PanelHeader eyebrow="CLI Agents" title="Claude Code / Codex CLI" description="Manage local CLI tools used by task cards." />
    <button className="empty-action settings-inline-action" type="button" onClick={onCreateCliTool}>
      <Plus size={16} />
      Add CLI profile
    </button>
    <div className="editor-stack settings-editor-stack">
      {activeWorkspace.cliToolProfiles.map((profile) => (
        <CliToolEditor
          key={profile.id}
          profile={profile}
          onUpdate={(updates) => onUpdateCliTool(profile.id, updates)}
          onDelete={() => onDeleteCliTool(profile.id)}
        />
      ))}
    </div>
  </>
);

const AgentSettings = ({ activeWorkspace, onCreateAgent, onDeleteAgent, onUpdateAgent }: SettingsModalProps) => (
  <>
    <PanelHeader eyebrow="Agent Profiles" title="Agent Profiles" description="Bundle skills, default models, execution modes, and notes." />
    <button className="empty-action settings-inline-action" type="button" onClick={onCreateAgent}>
      <Plus size={16} />
      Add agent profile
    </button>
    <div className="editor-stack settings-editor-stack">
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
  </>
);

const AppearanceSettings = ({ onThemeChange, themeMode }: SettingsModalProps) => (
  <>
    <PanelHeader
      eyebrow="Appearance"
      title="Theme Mode"
      description="Choose how kanban-agent should look. Theme changes apply immediately and are saved locally."
    />

    <div className="theme-option-grid" role="radiogroup" aria-label="Theme mode">
      {themeOptions.map((option) => (
        <button
          className={`theme-option ${themeMode === option.mode ? "active" : ""}`}
          key={option.mode}
          type="button"
          onClick={() => onThemeChange(option.mode)}
        >
          <ThemePreview mode={option.mode} />
          <strong>{option.title}</strong>
          <span>{option.description}</span>
        </button>
      ))}
    </div>

    <div className="settings-section">
      <h4>Interface</h4>
      <label>
        UI scale
        <select defaultValue="comfortable">
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </label>
      <label>
        Font size
        <select defaultValue="default">
          <option value="small">Small</option>
          <option value="default">Default</option>
          <option value="large">Large</option>
        </select>
      </label>
    </div>
  </>
);

const PlaceholderSettings = ({ title }: { title: SettingsCategory }) => (
  <>
    <PanelHeader eyebrow={title} title={title} description="This section is reserved for the next version of the desktop workflow." />
    <div className="settings-placeholder">No extra settings yet.</div>
  </>
);

const PanelHeader = ({ description, eyebrow, title }: { description: string; eyebrow: string; title: string }) => (
  <div className="settings-panel-header">
    <p className="eyebrow">{eyebrow}</p>
    <h3>{title}</h3>
    <p className="settings-copy">{description}</p>
  </div>
);

const ThemePreview = ({ mode }: { mode: ThemeMode }) => (
  <div className={`theme-preview ${mode}`}>
    <div />
    <span />
    <span />
  </div>
);
