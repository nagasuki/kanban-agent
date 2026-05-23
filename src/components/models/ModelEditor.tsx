import { Trash2 } from "lucide-react";
import { useState } from "react";
import { testModelConnection } from "../../agent/providers/providerRegistry";
import { MODEL_PROVIDERS } from "../../domain/constants";
import type { ModelProfile } from "../../domain/types";

interface ModelEditorProps {
  model: ModelProfile;
  onUpdate: (updates: Partial<ModelProfile>) => void;
  onDelete: () => void;
}

export const ModelEditor = ({ model, onUpdate, onDelete }: ModelEditorProps) => {
  const [connectionMessage, setConnectionMessage] = useState<string>("");

  const handleTestConnection = async () => {
    const result = await testModelConnection(model);
    setConnectionMessage(result.message);
  };

  return (
    <section className="mini-editor">
      <div className="mini-editor-actions">
        <input value={model.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        <button className="icon-button danger" title="Delete model profile" type="button" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>
      <label>
        Provider
        <select value={model.provider} onChange={(event) => onUpdate({ provider: event.target.value as ModelProfile["provider"] })}>
          {MODEL_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </label>
      <label>
        Model name
        <input value={model.modelName} onChange={(event) => onUpdate({ modelName: event.target.value })} />
      </label>
      <label>
        API key env / placeholder
        <input
          autoComplete="off"
          type="password"
          value={model.apiKeyPlaceholder}
          onChange={(event) => onUpdate({ apiKeyPlaceholder: event.target.value })}
        />
      </label>
      <label>
        Base URL placeholder
        <input
          value={model.baseUrlPlaceholder}
          onChange={(event) => onUpdate({ baseUrlPlaceholder: event.target.value })}
        />
      </label>
      <div className="two-col-form">
        <label>
          Temperature
          <input
            min={0}
            max={2}
            step={0.1}
            type="number"
            value={model.temperature}
            onChange={(event) => onUpdate({ temperature: Number(event.target.value) })}
          />
        </label>
        <label>
          Max tokens
          <input
            min={1}
            step={256}
            type="number"
            value={model.maxTokens}
            onChange={(event) => onUpdate({ maxTokens: Number(event.target.value) })}
          />
        </label>
      </div>
      <button className="empty-action" type="button" onClick={handleTestConnection}>
        Test Connection
      </button>
      {connectionMessage ? <p className="helper-text">{connectionMessage}</p> : null}
      <p className="helper-text">Secret values are not persisted yet. Use an environment variable name or placeholder.</p>
    </section>
  );
};
