import { useState } from "react";
import { Play, X } from "lucide-react";

interface PlanPromptModalProps {
  isGenerating: boolean;
  onClose: () => void;
  onManualSubmit: (prompt: string) => void;
  onSubmit: (prompt: string) => void;
}

export const PlanPromptModal = ({ isGenerating, onClose, onManualSubmit, onSubmit }: PlanPromptModalProps) => {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={isGenerating ? undefined : onClose}>
      <section
        aria-label="Create plan from prompt"
        aria-modal="true"
        className="plan-prompt-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-modal-header drawer-header">
          <div>
            <p className="eyebrow">Plan Mode</p>
            <h2>Create Plan</h2>
          </div>
          <button className="icon-button" disabled={isGenerating} title="Close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <form
          className="plan-prompt-body"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(prompt);
          }}
        >
          <label>
            Prompt
            <textarea
              autoFocus
              disabled={isGenerating}
              placeholder="Describe what you want the AI agent to plan..."
              rows={10}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>

          <div className="review-actions">
            <button disabled={isGenerating || !prompt.trim()} type="button" onClick={() => onManualSubmit(prompt)}>
              Manual Plan
            </button>
            <button disabled={isGenerating || !prompt.trim()} type="submit">
              <Play size={15} />
              {isGenerating ? "Generating plan..." : "Generate Plan Card"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
