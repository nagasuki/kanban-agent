import { Play, Trash2 } from "lucide-react";
import { useState } from "react";
import type { CliValidationResult } from "../../desktop/cliBridge";
import type { ProviderUsageAnalytics } from "../../domain/providerUsageService";
import type { CliToolProfile } from "../../domain/types";

interface CliToolEditorProps {
  profile: CliToolProfile;
  onDelete: () => void;
  onTest?: () => Promise<CliValidationResult>;
  onUpdate: (updates: Partial<CliToolProfile>) => void;
  usageStats?: ProviderUsageAnalytics;
}

export const CliToolEditor = ({ profile, onDelete, onTest, onUpdate, usageStats }: CliToolEditorProps) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<CliValidationResult | null>(null);
  const stats = usageStats ?? emptyUsageStats;

  const handleTest = async () => {
    if (!onTest) {
      setTestResult({
        ok: false,
        message: "Command testing is available from Settings.",
        resolvedExecutablePath: "",
        version: "",
        stdout: "",
        stderr: "Open Settings > CLI Agents to test this command.",
        exitCode: null
      });
      return;
    }
    setTesting(true);
    try {
      setTestResult(await onTest());
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="mini-editor">
      <div className="mini-editor-actions">
        <input value={profile.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        <button className="icon-button danger" title="Delete CLI profile" type="button" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>

      <label>
        Provider
        <select
          value={profile.provider}
          onChange={(event) => onUpdate({ provider: event.target.value as CliToolProfile["provider"] })}
        >
          <option value="Claude Code">Claude Code</option>
          <option value="Codex">Codex</option>
          <option value="Custom CLI">Custom CLI</option>
        </select>
      </label>

      <div className="provider-usage-strip">
        <span>Version: {testResult?.version || profile.detectedVersion || "Unknown"}</span>
        <span>Status: {profile.resolvedExecutablePath || testResult?.resolvedExecutablePath ? "Resolved" : "Not tested"}</span>
        <span>Sessions: {stats.totalSessions}</span>
        <span>Tokens Used: {formatUsageTokens(stats.totalTokens)}</span>
        <span>Estimated Cost: {formatUsageCost(stats.totalEstimatedCostUsd)}</span>
      </div>

      <div className="two-col-form">
        <label>
          Command
          <input
            value={profile.command}
            onChange={(event) => onUpdate({ command: event.target.value })}
            placeholder="cmd"
          />
        </label>

        <label>
          Args
          <input
            value={profile.args}
            onChange={(event) => onUpdate({ args: event.target.value })}
            placeholder="Claude: /c claude -p / Codex: /c codex exec -"
          />
        </label>
      </div>

      <div className="two-col-form">
        <label>
          Timeout seconds
          <input
            min={10}
            step={30}
            type="number"
            value={profile.timeoutSeconds}
            onChange={(event) => onUpdate({ timeoutSeconds: Number(event.target.value) })}
          />
        </label>
        <label>
          Working directory
          <input
            value={profile.workingDirectory ?? ""}
            onChange={(event) => onUpdate({ workingDirectory: event.target.value })}
            placeholder="Use card repo path"
          />
        </label>
      </div>

      <label className="checkbox-row">
        <input
          checked={Boolean(profile.keepStdinOpen)}
          type="checkbox"
          onChange={(event) => onUpdate({ keepStdinOpen: event.target.checked })}
        />
        Keep stdin open for live choice answers
      </label>

      <label>
        Resolved executable path
        <input
          value={profile.resolvedExecutablePath ?? ""}
          onChange={(event) => onUpdate({ resolvedExecutablePath: event.target.value })}
          placeholder="Auto-filled by Test Command"
        />
      </label>

      <label>
        Environment variables
        <textarea
          rows={3}
          value={profile.environmentVariables ?? ""}
          onChange={(event) => onUpdate({ environmentVariables: event.target.value })}
          placeholder={"NAME=value\nOTHER=value"}
        />
      </label>

      <button className="empty-action settings-inline-action" disabled={testing} type="button" onClick={handleTest}>
        <Play size={15} />
        {testing ? "Testing..." : "Test Command"}
      </button>

      {testResult ? (
        <div className={`cli-validation-result ${testResult.ok ? "success" : "warning"}`}>
          <strong>{testResult.message}</strong>
          {testResult.resolvedExecutablePath ? <span>Resolved Path: {testResult.resolvedExecutablePath}</span> : null}
          {testResult.version ? <span>Version: {testResult.version}</span> : null}
          {!testResult.ok && testResult.stderr ? <pre>{testResult.stderr}</pre> : null}
        </div>
      ) : null}

      <p className="helper-text">
        The generated prompt is piped to stdin. Defaults use cmd /c on Windows so npm global binaries, .cmd
        shims, and PATH lookup resolve reliably.
      </p>
    </section>
  );
};

const formatUsageTokens = (tokens: number) => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${Math.round(tokens)}`;
};

const formatUsageCost = (cost: number) => `$${cost.toFixed(cost < 0.01 ? 4 : 2)}`;

const emptyUsageStats: ProviderUsageAnalytics = {
  totalSessions: 0,
  totalTokens: 0,
  totalEstimatedCostUsd: 0,
  averageDurationMs: 0,
  averageTokensPerSession: 0,
  perProvider: [],
  daily: [],
  topCost: [],
  topTokens: [],
  topDuration: []
};
