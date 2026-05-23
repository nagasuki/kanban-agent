import { X } from "lucide-react";
import type { ThemeMode } from "../../app/theme";

interface SettingsModalProps {
  onClose: () => void;
  onThemeChange: (mode: ThemeMode) => void;
  themeMode: ThemeMode;
}

const categories = [
  "General",
  "Workspace",
  "AI Models",
  "Agent Profiles",
  "Skill Presets",
  "Execution Rules",
  "Sandbox & Safety",
  "Git Integration",
  "Appearance",
  "Logs",
  "Experimental"
];

const themeOptions: Array<{ mode: ThemeMode; title: string; description: string }> = [
  { mode: "dark", title: "Dark Mode", description: "Low-strain developer workspace." },
  { mode: "light", title: "Light Mode", description: "Soft, bright interface for daytime work." },
  { mode: "system", title: "System Default", description: "Follow your operating system theme." }
];

export const SettingsModal = ({ onClose, onThemeChange, themeMode }: SettingsModalProps) => {
  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
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
            <button className="icon-button" title="Close settings" type="button" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <nav className="settings-nav">
            {categories.map((category) => (
              <button className={category === "Appearance" ? "active" : ""} key={category} type="button">
                {category}
              </button>
            ))}
          </nav>
        </aside>

        <main className="settings-panel">
          <p className="eyebrow">Appearance</p>
          <h3>Theme Mode</h3>
          <p className="settings-copy">
            Choose how kanban-agent should look. Theme changes apply immediately and are saved locally.
          </p>

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
        </main>
      </section>
    </div>
  );
};

const ThemePreview = ({ mode }: { mode: ThemeMode }) => (
  <div className={`theme-preview ${mode}`}>
    <div />
    <span />
    <span />
  </div>
);
