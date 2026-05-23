import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { testModelConnection } from "../../agent/providers/providerRegistry";
import { secureKeyStore } from "../../desktop/secureKeyStore";
import { MODEL_PROVIDERS } from "../../domain/constants";
import type { ModelProfile } from "../../domain/types";

interface ModelEditorProps {
  model: ModelProfile;
  onUpdate: (updates: Partial<ModelProfile>) => void;
  onDelete: () => void;
}

export const ModelEditor = ({ model, onUpdate, onDelete }: ModelEditorProps) => {
  const [connectionMessage, setConnectionMessage] = useState<string>("");
  const [secretInput, setSecretInput] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    let isMounted = true;
    secureKeyStore.has(secureKeyStore.keyForModel(model.id)).then((status) => {
      if (isMounted) {
        setHasStoredKey(status.hasKey);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [model.id]);

  const handleTestConnection = async () => {
    const apiKeyResult = await secureKeyStore.get(secureKeyStore.keyForModel(model.id));
    const result = await testModelConnection(model, apiKeyResult.value);
    setConnectionMessage(result.message);
  };

  const handleSaveSecret = async () => {
    if (!secretInput.trim()) {
      setConnectionMessage("Enter an API key before saving.");
      return;
    }

    const result = await secureKeyStore.set(secureKeyStore.keyForModel(model.id), secretInput);
    setConnectionMessage(result.message);
    setHasStoredKey(result.ok);
    if (result.ok) {
      setSecretInput("");
    }
  };

  const handleDeleteSecret = async () => {
    const result = await secureKeyStore.delete(secureKeyStore.keyForModel(model.id));
    setConnectionMessage(result.message);
    setHasStoredKey(false);
    setSecretInput("");
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
        API key env / label
        <input
          autoComplete="off"
          value={model.apiKeyPlaceholder}
          onChange={(event) => onUpdate({ apiKeyPlaceholder: event.target.value })}
        />
      </label>
      <label>
        Secure API key
        <input
          autoComplete="off"
          placeholder={hasStoredKey ? "Stored securely" : "Paste key to store in desktop key vault"}
          type="password"
          value={secretInput}
          onChange={(event) => setSecretInput(event.target.value)}
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
      <div className="button-row">
        <button type="button" onClick={handleSaveSecret}>
          Store Key
        </button>
        <button type="button" onClick={handleDeleteSecret}>
          Remove Key
        </button>
      </div>
      <p className={`helper-text ${hasStoredKey ? "success-text" : ""}`}>
        {hasStoredKey ? "A secure API key is stored for this profile." : "No secure API key is stored for this profile."}
      </p>
      {connectionMessage ? <p className="helper-text">{connectionMessage}</p> : null}
      <p className="helper-text">
        Secret values are stored through Electron secure storage and are not written into localStorage.
      </p>
    </section>
  );
};
