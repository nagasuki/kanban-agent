import type { ModelProviderClient } from "./modelProvider";

export const openAiProvider: ModelProviderClient = {
  id: "openai",
  label: "OpenAI",

  runPlanOnly: async ({ apiKey, model, onStream, prompt }) => {
    if (!apiKey) {
      return {
        provider: "OpenAI",
        summary: "OpenAI Plan Only is ready, but no secure API key is stored for this model profile.",
        rawText: "Store an API key in the desktop app, then run Plan Only again."
      };
    }

    const baseUrl = model.baseUrlPlaceholder.replace(/\/$/, "") || "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model.modelName,
        temperature: model.temperature,
        max_tokens: model.maxTokens,
        stream: true,
        messages: [
          { role: "system", content: prompt.systemPrompt },
          { role: "user", content: prompt.userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        provider: "OpenAI",
        summary: `OpenAI Plan Only failed with HTTP ${response.status}.`,
        rawText: text || response.statusText
      };
    }

    const text = await readOpenAiCompatibleStream(response, onStream);

    return {
      provider: "OpenAI",
      summary: text,
      rawText: text
    };
  },

  testConnection: async (model, apiKey) => {
    if (!model.modelName.trim()) {
      return { ok: false, message: "Model name is required." };
    }

    if (!apiKey) {
      return { ok: false, message: "No secure API key is stored for this OpenAI profile." };
    }

    return { ok: true, message: "OpenAI profile has a stored key. Full network validation runs during Plan Only." };
  }
};

const readOpenAiCompatibleStream = async (response: Response, onStream?: (message: string) => void): Promise<string> => {
  if (!response.body) {
    return "Provider returned an empty response body.";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let streamedSinceLog = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const payload = trimmed.slice("data:".length).trim();
      if (payload === "[DONE]") {
        continue;
      }

      try {
        const data = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.delta?.content ?? data.choices?.[0]?.message?.content ?? "";
        fullText += content;
        streamedSinceLog += content;

        if (streamedSinceLog.length >= 240) {
          onStream?.(streamedSinceLog);
          streamedSinceLog = "";
        }
      } catch {
        onStream?.(`Skipped malformed stream payload: ${payload.slice(0, 80)}`);
      }
    }
  }

  if (streamedSinceLog.trim()) {
    onStream?.(streamedSinceLog);
  }

  return fullText || "Provider returned an empty response.";
};
