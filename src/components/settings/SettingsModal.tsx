import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { CliValidationResult } from "../../desktop/cliBridge";
import type { ThemeMode } from "../../app/theme";
import { aggregateUsageRecords, usageForProvider } from "../../domain/providerUsageService";
import { implementAgentsForWorkspace, planAgentsForWorkspace } from "../../domain/agentCapabilities";
import type { AgentProfile, AppState, CliToolProfile, ModelProfile, ProviderUsageRecord, SkillPreset, Workspace } from "../../domain/types";
import { AgentEditor } from "../agents/AgentEditor";
import { CliToolEditor } from "../cli/CliToolEditor";
import { ModelEditor } from "../models/ModelEditor";
import { SkillEditor } from "../skills/SkillEditor";
import { BranchSelect } from "../workspace/BranchSelect";
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
  onTestCliTool: (profile: CliToolProfile) => Promise<CliValidationResult>;
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
  | "Usage Dashboard"
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
  "Usage Dashboard",
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
          {category === "Usage Dashboard" ? <UsageDashboardSettings {...props} /> : null}
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
  const branchOptions = [
    activeWorkspace.repoInspection?.currentBranch,
    activeWorkspace.defaultBranch,
    ...(activeWorkspace.repoInspection?.branches ?? [])
  ].filter((branch, index, options): branch is string => Boolean(branch) && options.indexOf(branch) === index);
  const planAgents = planAgentsForWorkspace(activeWorkspace);
  const implementAgents = implementAgentsForWorkspace(activeWorkspace);

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
      <BranchSelect
        branches={branchOptions}
        disabled={branchOptions.length === 0}
        value={activeWorkspace.defaultBranch || activeWorkspace.repoInspection?.currentBranch || ""}
        onChange={(branch) => {
          onUpdateWorkspace({ defaultBranch: branch });
          if (branch && branch !== activeWorkspace.repoInspection?.currentBranch) {
            onSwitchBranch(branch);
          }
        }}
      />
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
        Default Plan Agent
        <select
          value={activeWorkspace.defaultPlanAgentProfileId}
          onChange={(event) => onUpdateWorkspace({ defaultPlanAgentProfileId: event.target.value })}
        >
          <option value="">No default Plan Agent</option>
          {planAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Default Implement Agent
        <select
          value={activeWorkspace.defaultImplementAgentProfileId}
          onChange={(event) => onUpdateWorkspace({ defaultImplementAgentProfileId: event.target.value })}
        >
          <option value="">No default Implement Agent</option>
          {implementAgents.map((agent) => (
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

const CliSettings = ({ activeWorkspace, onCreateCliTool, onDeleteCliTool, onTestCliTool, onUpdateCliTool }: SettingsModalProps) => (
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
          onTest={() => onTestCliTool(profile)}
          onDelete={() => onDeleteCliTool(profile.id)}
          usageStats={usageForProvider(activeWorkspace, profile)}
        />
      ))}
    </div>
  </>
);

const UsageDashboardSettings = ({ state }: SettingsModalProps) => {
  const [providerFilter, setProviderFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minCost, setMinCost] = useState("");
  const [maxCost, setMaxCost] = useState("");
  const allRecords = state.workspaces.flatMap((workspace) => workspace.providerUsageRecords ?? []);
  const workspaceOptions = state.workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name }));
  const providerOptions = unique(allRecords.map((record) => record.providerId).filter(Boolean));
  const modelOptions = unique(allRecords.map((record) => record.modelName).filter(Boolean) as string[]);
  const filteredRecords = allRecords.filter((record) => {
    const workspace = state.workspaces.find((item) => item.id === record.workspaceId);
    const session = workspace?.cards.flatMap((card) => card.sessions).find((item) => item.id === record.sessionId);
    const cost = record.estimatedCostUsd ?? 0;
    return (
      (!providerFilter || record.providerId === providerFilter) &&
      (!modelFilter || record.modelName === modelFilter) &&
      (!workspaceFilter || record.workspaceId === workspaceFilter) &&
      (!statusFilter || session?.status === statusFilter) &&
      (!startDate || record.completedAt.slice(0, 10) >= startDate) &&
      (!endDate || record.completedAt.slice(0, 10) <= endDate) &&
      (!minCost || cost >= Number(minCost)) &&
      (!maxCost || cost <= Number(maxCost))
    );
  });
  const analytics = aggregateUsageRecords(filteredRecords);
  const modelStats = Array.from(groupUsageByModel(filteredRecords).entries()).map(([modelName, records]) => ({
    modelName,
    sessions: records.length,
    tokens: records.reduce((total, record) => total + record.totalTokens, 0),
    cost: records.reduce((total, record) => total + (record.estimatedCostUsd ?? 0), 0)
  }));

  return (
    <>
      <PanelHeader
        eyebrow="Usage Dashboard"
        title="Provider Usage"
        description="Track provider sessions, estimated tokens, cost, and activity across workspaces."
      />

      <div className="usage-filter-grid">
        <label>
          Provider
          <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
            <option value="">All providers</option>
            {providerOptions.map((providerId) => (
              <option key={providerId} value={providerId}>
                {providerId}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model
          <select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}>
            <option value="">All models</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workspace
          <select value={workspaceFilter} onChange={(event) => setWorkspaceFilter(event.target.value)}>
            <option value="">All workspaces</option>
            {workspaceOptions.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Session status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label>
          From
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <label>
          Min cost
          <input type="number" min="0" step="0.01" value={minCost} onChange={(event) => setMinCost(event.target.value)} />
        </label>
        <label>
          Max cost
          <input type="number" min="0" step="0.01" value={maxCost} onChange={(event) => setMaxCost(event.target.value)} />
        </label>
      </div>

      <div className="usage-metric-grid">
        <UsageMetric label="Sessions" value={`${analytics.totalSessions}`} />
        <UsageMetric label="Tokens" value={formatDashboardTokens(analytics.totalTokens)} />
        <UsageMetric label="Estimated Cost" value={formatDashboardCost(analytics.totalEstimatedCostUsd)} />
        <UsageMetric label="Avg Duration" value={formatDashboardDuration(analytics.averageDurationMs)} />
        <UsageMetric label="Avg Tokens/Session" value={formatDashboardTokens(analytics.averageTokensPerSession)} />
      </div>

      <div className="button-row">
        <button type="button" onClick={() => exportUsageJson(filteredRecords)}>
          Export JSON
        </button>
        <button type="button" onClick={() => exportUsageCsv(filteredRecords)}>
          Export CSV
        </button>
      </div>

      <div className="settings-section">
        <h4>Per Provider</h4>
        <div className="usage-table">
          {analytics.perProvider.map((provider) => (
            <div className="usage-table-row" key={provider.providerId}>
              <strong>{provider.providerName}</strong>
              <span>{provider.totalSessions} sessions</span>
              <span>{formatDashboardTokens(provider.totalTokens)}</span>
              <span>{formatDashboardCost(provider.totalEstimatedCostUsd)}</span>
              <span>{formatDashboardDuration(provider.averageDurationMs)} avg</span>
            </div>
          ))}
          {analytics.perProvider.length === 0 ? <p className="helper-text">No usage records match these filters.</p> : null}
        </div>
      </div>

      <div className="settings-section">
        <h4>Model Usage</h4>
        <div className="usage-table">
          {modelStats.map((model) => (
            <div className="usage-table-row" key={model.modelName}>
              <strong>{model.modelName}</strong>
              <span>{model.sessions} sessions</span>
              <span>{formatDashboardTokens(model.tokens)}</span>
              <span>{formatDashboardCost(model.cost)}</span>
              <span>{formatDashboardTokens(model.sessions > 0 ? model.tokens / model.sessions : 0)} avg</span>
            </div>
          ))}
          {modelStats.length === 0 ? <p className="helper-text">No model usage records match these filters.</p> : null}
        </div>
      </div>

      <UsageBars title="Sessions / Day" records={analytics.daily} valueKey="sessions" valueLabel={(value) => `${value}`} />
      <UsageBars title="Tokens / Day" records={analytics.daily} valueKey="tokens" valueLabel={formatDashboardTokens} />
      <UsageBars title="Cost / Day" records={analytics.daily} valueKey="estimatedCostUsd" valueLabel={formatDashboardCost} />

      <TopUsage title="Most Expensive Tasks" records={analytics.topCost} value={(record) => formatDashboardCost(record.estimatedCostUsd ?? 0)} />
      <TopUsage title="Largest Token Sessions" records={analytics.topTokens} value={(record) => formatDashboardTokens(record.totalTokens)} />
      <TopUsage title="Longest Running Sessions" records={analytics.topDuration} value={(record) => formatDashboardDuration(record.executionDurationMs)} />
    </>
  );
};

const UsageMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="usage-metric">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const UsageBars = ({
  records,
  title,
  valueKey,
  valueLabel
}: {
  records: Array<{ date: string; sessions: number; tokens: number; estimatedCostUsd: number }>;
  title: string;
  valueKey: "sessions" | "tokens" | "estimatedCostUsd";
  valueLabel: (value: number) => string;
}) => {
  const max = Math.max(1, ...records.map((record) => Number(record[valueKey])));
  return (
    <div className="settings-section">
      <h4>{title}</h4>
      <div className="usage-bars">
        {records.slice(-14).map((record) => {
          const value = Number(record[valueKey]);
          return (
            <div className="usage-bar-row" key={`${title}-${record.date}`}>
              <span>{record.date}</span>
              <div><i style={{ width: `${Math.max(3, (value / max) * 100)}%` }} /></div>
              <strong>{valueLabel(value)}</strong>
            </div>
          );
        })}
        {records.length === 0 ? <p className="helper-text">No daily usage yet.</p> : null}
      </div>
    </div>
  );
};

const TopUsage = ({
  records,
  title,
  value
}: {
  records: ProviderUsageRecord[];
  title: string;
  value: (record: ProviderUsageRecord) => string;
}) => (
  <div className="settings-section">
    <h4>{title}</h4>
    <div className="usage-table">
      {records.map((record) => (
        <div className="usage-table-row" key={`${title}-${record.id}`}>
          <strong>{record.providerName}</strong>
          <span>{record.cardId || "No card"}</span>
          <span>{record.wasEstimated ? "Estimated" : "Exact"}</span>
          <span>{value(record)}</span>
        </div>
      ))}
      {records.length === 0 ? <p className="helper-text">No usage records yet.</p> : null}
    </div>
  </div>
);

const unique = (values: string[]): string[] => Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

const groupUsageByModel = (records: ProviderUsageRecord[]): Map<string, ProviderUsageRecord[]> => {
  const groups = new Map<string, ProviderUsageRecord[]>();
  for (const record of records) {
    const key = record.modelName || `${record.providerName} default`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return groups;
};

const formatDashboardTokens = (tokens: number) => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${Math.round(tokens)}`;
};

const formatDashboardCost = (cost: number) => `$${cost.toFixed(cost < 0.01 ? 4 : 2)}`;

const formatDashboardDuration = (durationMs: number) => {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const exportUsageJson = (records: ProviderUsageRecord[]) => {
  downloadUsageFile("kanban-agent-usage.json", "application/json", JSON.stringify(records, null, 2));
};

const exportUsageCsv = (records: ProviderUsageRecord[]) => {
  const headers = [
    "id",
    "providerId",
    "providerName",
    "modelName",
    "sessionId",
    "cardId",
    "workspaceId",
    "inputTokens",
    "outputTokens",
    "totalTokens",
    "estimatedInputTokens",
    "estimatedOutputTokens",
    "estimatedCostUsd",
    "executionDurationMs",
    "requestCount",
    "startedAt",
    "completedAt",
    "wasEstimated",
    "cliVersion"
  ];
  const rows = records.map((record) =>
    headers.map((header) => csvCell(String(record[header as keyof ProviderUsageRecord] ?? ""))).join(",")
  );
  downloadUsageFile("kanban-agent-usage.csv", "text/csv", [headers.join(","), ...rows].join("\n"));
};

const downloadUsageFile = (filename: string, type: string, content: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const csvCell = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

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
