import { createId, nowIso } from "./id";
import type { SkillPreset, Workspace } from "./types";

export const createSkill = (workspace: Workspace): Workspace => {
  const timestamp = nowIso();
  const skill: SkillPreset = {
    id: createId("skill"),
    name: "New Skill Preset",
    version: "0.1.0",
    description: "Reusable agent skill profile.",
    markdown: "# New Skill Preset\n\nDescribe the role, constraints, and expected output.",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...workspace,
    skills: [skill, ...workspace.skills],
    updatedAt: timestamp
  };
};

export const updateSkill = (workspace: Workspace, skillId: string, updates: Partial<SkillPreset>): Workspace => {
  const timestamp = nowIso();
  return {
    ...workspace,
    skills: workspace.skills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            ...updates,
            updatedAt: timestamp
          }
        : skill
    ),
    updatedAt: timestamp
  };
};

export const duplicateSkill = (workspace: Workspace, skillId: string): Workspace => {
  const source = workspace.skills.find((skill) => skill.id === skillId);
  if (!source) {
    return workspace;
  }

  const timestamp = nowIso();
  return {
    ...workspace,
    skills: [
      {
        ...source,
        id: createId("skill"),
        name: `${source.name} copy`,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      ...workspace.skills
    ],
    updatedAt: timestamp
  };
};

export const deleteSkill = (workspace: Workspace, skillId: string): Workspace => ({
  ...workspace,
  skills: workspace.skills.filter((skill) => skill.id !== skillId),
  cards: workspace.cards.map((card) => ({
    ...card,
    skillIds: card.skillIds.filter((id) => id !== skillId)
  })),
  updatedAt: nowIso()
});
