export const createId = (prefix: string): string => {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
};

export const nowIso = (): string => new Date().toISOString();
