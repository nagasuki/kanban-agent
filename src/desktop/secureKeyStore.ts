export interface SecureKeySetResult {
  ok: boolean;
  message: string;
}

export interface SecureKeyGetResult {
  ok: boolean;
  value: string | null;
  message: string;
}

export interface SecureKeyStatus {
  ok: boolean;
  hasKey: boolean;
  encryptionAvailable: boolean;
}

export const secureKeyStore = {
  isAvailable: () => Boolean(window.kanbanAgent?.secureKeys),

  keyForModel: (modelId: string) => `model-api-key:${modelId}`,

  set: async (key: string, value: string): Promise<SecureKeySetResult> => {
    if (!window.kanbanAgent?.secureKeys) {
      return { ok: false, message: "Secure key storage is only available in the Electron desktop app." };
    }

    return window.kanbanAgent.secureKeys.set(key, value);
  },

  get: async (key: string): Promise<SecureKeyGetResult> => {
    if (!window.kanbanAgent?.secureKeys) {
      return {
        ok: false,
        value: null,
        message: "Secure key storage is only available in the Electron desktop app."
      };
    }

    return window.kanbanAgent.secureKeys.get(key);
  },

  delete: async (key: string): Promise<SecureKeySetResult> => {
    if (!window.kanbanAgent?.secureKeys) {
      return { ok: false, message: "Secure key storage is only available in the Electron desktop app." };
    }

    return window.kanbanAgent.secureKeys.delete(key);
  },

  has: async (key: string): Promise<SecureKeyStatus> => {
    if (!window.kanbanAgent?.secureKeys) {
      return { ok: false, hasKey: false, encryptionAvailable: false };
    }

    return window.kanbanAgent.secureKeys.has(key);
  }
};
