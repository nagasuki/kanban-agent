import { createId, nowIso } from "./id";
import type { CliToolProfile, Workspace } from "./types";

export const createCliToolProfile = (workspace: Workspace): Workspace => {
  const timestamp = nowIso();
  const profile: CliToolProfile = {
    id: createId("cli"),
    name: "Custom CLI Agent",
    provider: "Custom CLI",
    command: "agent",
    args: "",
    timeoutSeconds: 300,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...workspace,
    defaultCliToolProfileId: workspace.defaultCliToolProfileId || profile.id,
    cliToolProfiles: [profile, ...workspace.cliToolProfiles],
    updatedAt: timestamp
  };
};

export const updateCliToolProfile = (
  workspace: Workspace,
  profileId: string,
  updates: Partial<CliToolProfile>
): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    cliToolProfiles: workspace.cliToolProfiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            ...updates,
            updatedAt: timestamp
          }
        : profile
    ),
    updatedAt: timestamp
  };
};

export const deleteCliToolProfile = (workspace: Workspace, profileId: string): Workspace => {
  const profiles = workspace.cliToolProfiles.filter((profile) => profile.id !== profileId);
  const fallbackProfileId = profiles[0]?.id ?? "";

  return {
    ...workspace,
    defaultCliToolProfileId:
      workspace.defaultCliToolProfileId === profileId ? fallbackProfileId : workspace.defaultCliToolProfileId,
    cliToolProfiles: profiles,
    cards: workspace.cards.map((card) => ({
      ...card,
      cliToolProfileId: card.cliToolProfileId === profileId ? undefined : card.cliToolProfileId
    })),
    updatedAt: nowIso()
  };
};
