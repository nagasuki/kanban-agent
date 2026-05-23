# Kanban Agent Roadmap to v1.0

## Product Vision

**kanban-agent** is a desktop app for controlling AI agent workflows through a Kanban board.  
It is not just a task board. It is a developer control panel for planning, assigning skills, selecting models, executing implementation tasks, reviewing results, and safely completing work.

Core idea:

```text
Skill → Plan → Assign → Implement → Observe → Review → Done
```

The app should feel like a mix of:

- Linear / GitHub Projects for task flow
- VS Code for developer workflow
- Unity Editor-style control surface for agent execution
- Git client for diff/review safety

---

## Fixed Board Columns

The app uses 7 fixed columns:

1. **My Skill**  
   Stores reusable `skill.md` presets.

2. **My Plan**  
   Stores planned tasks before implementation.

3. **Skill Used**  
   Shows selected skill/profile/context prepared for execution.

4. **Start Implement**  
   A staging lane before the agent starts work.

5. **In Process**  
   Shows running or paused implementation tasks.

6. **In Review**  
   Shows completed implementation waiting for user approval.

7. **Successfully**  
   Stores fully approved and completed work.

---

# Version Roadmap

## v0.1 — Local Prototype

Goal: Build a usable local Kanban prototype with no real AI execution yet.

### Core App

- [x] Create desktop app scaffold.
- [x] Use Electron + React + TypeScript.
- [x] Add strict TypeScript config.
- [x] Add dark mode first UI.
- [x] Add app shell layout.
- [x] Add left sidebar.
- [x] Add main Kanban board area.
- [x] Add right-side card detail drawer.

### Board

- [x] Add 7 fixed columns.
- [x] Add card creation.
- [x] Add card editing.
- [x] Add card deletion.
- [x] Add drag and drop between columns.
- [x] Add automatic activity log when moving cards.
- [x] Add local seed data.

### Data Model

- [x] Add `Workspace` type.
- [x] Add `KanbanCard` type.
- [x] Add `BoardColumn` type.
- [x] Add `SkillPreset` type.
- [x] Add `ModelProfile` type.
- [x] Add `AgentProfile` type.
- [x] Add `ExecutionMode` type.
- [x] Add `SafetySettings` type.
- [x] Add `ReviewChecklist` type.
- [x] Add `ActivityLogEntry` type.

### Local Persistence

- [x] Save board data locally.
- [x] Load board data on app start.
- [x] Add reset-to-seed-data option.

### Acceptance Criteria

- [x] User can open app.
- [x] User can create a card.
- [x] User can move card across all 7 columns.
- [x] User can open card detail drawer.
- [x] User can close and reopen app without losing data.

---

## v0.2 — Skill and Model Management

Goal: Make the app useful for preparing AI work, even before execution exists.

### Skill Presets

- [x] Create skill preset.
- [x] Edit skill markdown.
- [x] Duplicate skill preset.
- [x] Delete skill preset.
- [x] Assign skill preset to card.
- [x] Support multiple skills per card.
- [x] Add skill version field.
- [x] Add default skill templates.

Example default skills:

- [x] Unity Programmer
- [x] Code Reviewer
- [x] Refactor Agent
- [x] Bug Fix Agent
- [x] Documentation Writer
- [x] TypeScript App Developer

### Model Profiles

- [x] Add model profile CRUD.
- [x] Add provider field.
- [x] Add model name field.
- [x] Add base URL field.
- [x] Add API key placeholder field.
- [x] Add temperature field.
- [x] Add max tokens field.
- [x] Assign model profile to card.
- [x] Set workspace default model.

Supported provider options:

- [x] OpenAI
- [x] Anthropic
- [x] Google
- [x] Local
- [x] Custom API

### Agent Profiles

- [x] Create agent profile.
- [x] Link agent profile to default skill.
- [x] Link agent profile to default model.
- [x] Link agent profile to default execution mode.

### Acceptance Criteria

- [x] User can create reusable skills.
- [x] User can assign skill and model to a plan.
- [x] User can prepare a card for implementation without API integration.

---

## v0.3 — Workspace and Project Context

Goal: Support real project organization.

### Workspace

- [x] Create workspace.
- [x] Rename workspace.
- [x] Delete workspace.
- [x] Switch workspace.
- [x] Save separate board per workspace.
- [x] Save separate skills per workspace.
- [x] Save separate model profiles per workspace.

### Project Context

Each workspace should support:

- [x] Project name.
- [x] Repo path.
- [x] Default branch.
- [x] Default model profile.
- [x] Default agent profile.
- [x] Allowed editable folders.
- [x] Blocked file patterns.
- [x] Test command.
- [x] Build command.

### Card Context

Each card should support:

- [x] Target repo path override.
- [x] Target files.
- [x] Target folders.
- [x] Related documents.
- [x] Related issue link.
- [x] Extra prompt notes.

### Acceptance Criteria

- [x] User can manage multiple projects.
- [x] Each project has separate tasks, skills, and settings.
- [x] Cards can carry enough context for future agent execution.

---

## v0.4 — Execution Preview and Fake Runner

Goal: Build the execution UX before connecting real AI.

### Execution Modes

Support these modes:

- [x] Plan Only
- [x] Suggest Patch
- [x] Apply Patch
- [x] Apply + Run Test
- [x] Apply + Commit
- [x] Apply + PR

### Execution Preview

When a card enters **Start Implement**, show:

- [x] Selected model.
- [x] Selected skills.
- [x] Plan markdown.
- [x] Project context.
- [x] Target files/folders.
- [x] Execution mode.
- [x] Safety settings.
- [x] Final generated prompt preview.

### Fake Runner

- [x] Add simulated execution start.
- [x] Move card from Start Implement to In Process.
- [x] Append fake activity logs.
- [x] Generate fake result summary.
- [x] Move card to In Review when fake execution finishes.
- [x] Add retry action.
- [x] Add cancel action.

### Acceptance Criteria

- [x] User can preview what will be sent to an AI agent.
- [x] User can simulate running a task.
- [x] User can review fake output before completion.

---

## v0.5 — Safety, Review, and Approval Gate

Goal: Make the workflow safe before real file editing exists.

### Safety Settings

Each card should support:

- [x] Preview diff before apply.
- [x] Backup before edit.
- [x] Restrict editable folders.
- [x] Block `.env` files.
- [x] Block secret files.
- [x] Require approval before commit.
- [x] Require approval before PR.

### Review Checklist

In Review cards should have checklist:

- [x] Scope matches plan.
- [x] Build/test passed.
- [x] Code style acceptable.
- [x] No risky file changed.
- [x] Summary is clear.
- [x] User approved.

### Review Actions

- [x] Approve.
- [x] Request Changes.
- [x] Retry.
- [x] Rollback.
- [x] Move to Successfully only after approval.
- [x] Show warning if user tries to move unapproved card to Successfully.

### Acceptance Criteria

- [x] User cannot accidentally complete unreviewed work.
- [x] Review status is visible on every implemented card.
- [x] Every important action writes to the activity log.

---

## v0.6 — Real AI API Integration

Goal: Start calling real models safely, but still without editing files.

### Provider Layer

- [x] Create model provider interface.
- [x] Add OpenAI-compatible provider.
- [x] Add Anthropic provider.
- [x] Add Google provider.
- [x] Add Custom API provider.
- [x] Add Local model provider placeholder.

### API Key Handling

- [x] Store API keys securely.
- [x] Do not store keys in plain local storage.
- [x] Mask API keys in UI.
- [x] Add test connection button.

### Agent Prompt Generation

- [x] Generate final prompt from plan + skill + context.
- [x] Support system prompt.
- [x] Support user prompt.
- [x] Support skill markdown injection.
- [x] Support execution mode instructions.
- [x] Support safety instructions.

### Plan Only Mode

- [x] Implement real Plan Only execution.
- [x] Stream response into activity log.
- [x] Save response as result summary.
- [x] Move card to In Review after completion.

### Acceptance Criteria

- [x] User can call a real model.
- [x] User can generate an implementation plan from a card.
- [x] No files are modified yet.

---

## v0.7 — Repo Reading and Patch Suggestion

Goal: Let the app inspect project files and suggest diffs.

### File System Access

- [x] Select repo folder.
- [x] Read allowed files.
- [x] Respect blocked file patterns.
- [x] Respect allowed editable folders.
- [x] Show file tree.
- [x] Attach files to card context.

### Git Awareness

- [x] Detect if folder is Git repo.
- [x] Show current branch.
- [x] Show dirty state.
- [x] Show changed files.
- [x] Warn before running on dirty repo.

### Suggest Patch Mode

- [x] Add local Claude Code / Codex CLI runner profile support.
- [x] Send selected file context to model.
- [x] Ask model to return proposed patch.
- [x] Show patch in diff viewer.
- [x] Save patch to card.
- [x] Do not apply patch automatically.

### Acceptance Criteria

- [x] User can attach real files to a task.
- [x] AI can suggest a patch.
- [x] User can inspect patch before applying.

---

## v0.8 — Patch Apply, Backup, and Test Runner

Goal: Make the app useful for real implementation tasks.

### Patch Apply

- [x] Apply approved patch to files.
- [x] Create backup before applying if enabled.
- [x] Validate blocked files before apply.
- [x] Validate allowed folders before apply.
- [x] Show apply result.
- [ ] Show changed files after apply.

### Rollback

- [ ] Rollback from backup.
- [x] Rollback via git checkout for changed files.
- [x] Add rollback log.

### Test Runner

- [x] Configure test command per workspace.
- [x] Run test command.
- [ ] Stream test output.
- [x] Save test result to card.
- [x] Mark review checklist based on test result.

### Build Runner

- [x] Configure build command per workspace.
- [x] Run build command.
- [ ] Stream build output.
- [x] Save build result to card.

### Acceptance Criteria

- [x] User can apply AI-suggested changes safely.
- [x] User can rollback if result is bad.
- [x] User can run tests/builds from the app.

---

## v0.9 — Commit, PR, and Production UX

Goal: Prepare the app for daily real usage.

### Git Commit

- [x] Show final diff before commit.
- [x] Generate commit message.
- [x] Allow user to edit commit message.
- [x] Commit only approved changes.
- [x] Require approval before commit.

### Pull Request

- [x] Generate PR title.
- [x] Generate PR description.
- [x] Support GitHub integration.
- [x] Create PR only after user approval.
- [x] Link PR to card.

### Queue System

- [ ] Add execution queue.
- [ ] Prevent multiple agents from editing the same repo at the same time.
- [x] Lock card while running.
- [ ] Allow cancel running task.
- [x] Allow retry failed task.

### UX Polish

- [x] Search cards.
- [x] Filter by skill.
- [x] Filter by model.
- [x] Filter by status.
- [ ] Add keyboard shortcuts.
- [x] Add compact card view.
- [x] Add activity log viewer.
- [x] Add diff viewer polish.

### Acceptance Criteria

- [x] User can go from plan to patch to test to commit.
- [x] User can create PR from approved work.
- [ ] App feels stable enough for daily internal use.

---

# v1.0 — Real Usable Release

Goal: The app is usable as a real local AI coding workflow tool.

## Required v1.0 Features

### Board Workflow

- [x] 7 fixed columns are stable.
- [x] Drag and drop is reliable.
- [x] Card detail drawer is complete.
- [x] Activity log is complete.
- [x] Review gate is enforced.

### Skills

- [x] Skill markdown presets work.
- [x] Skill versioning works.
- [x] Skills can be assigned to cards.
- [ ] Skills can be shared across workspaces or kept local.

### Model Profiles

- [ ] OpenAI-compatible provider works.
- [ ] Anthropic provider works.
- [ ] Google provider works.
- [ ] Custom API provider works.
- [x] API keys are stored securely.
- [x] Model connection test works.

### Execution

- [x] Plan Only works.
- [x] Suggest Patch works.
- [x] Apply Patch works.
- [x] Apply + Run Test works.
- [x] Apply + Commit works.
- [x] Apply + PR works.

### Repo Safety

- [x] Blocked files cannot be edited.
- [x] Restricted folders are respected.
- [x] Dirty repo warning works.
- [x] Backup before edit works.
- [x] Rollback works.
- [x] Approval before commit works.

### Review

- [x] Diff viewer works.
- [x] Test/build output viewer works.
- [x] Review checklist works.
- [x] Request changes works.
- [x] Retry works.
- [x] Successfully requires approval.

### Workspace

- [x] Multiple workspaces work.
- [x] Workspace settings persist.
- [x] Workspace repo path works.
- [x] Workspace default skill/model works.

### Reliability

- [x] App can recover from failed model call.
- [x] App can recover from failed patch apply.
- [x] App can recover from failed test command.
- [ ] Running task can be cancelled.
- [x] Logs are preserved after restart.

### Packaging

- [ ] Build Windows installer.
- [ ] Build macOS app if possible.
- [ ] Build Linux app if possible.
- [ ] Add auto update placeholder or documentation.
- [ ] Add app icon.
- [ ] Add basic settings page.

---

# Recommended v1.0 Architecture

## Frontend

```text
React + TypeScript
```

Responsibilities:

- Kanban board UI
- Card detail drawer
- Skill editor
- Model profile editor
- Workspace settings
- Diff viewer
- Logs viewer
- Review UI

## Desktop Shell

```text
Electron
```

Responsibilities:

- File system access
- Secure key storage bridge
- Running shell commands
- Git command bridge
- Native dialogs
- App packaging

## Domain Layer

Responsibilities:

- Board workflow rules
- Card transition rules
- Review gate rules
- Execution mode rules
- Safety validation
- Prompt generation

## Agent Runner Layer

Responsibilities:

- Build prompt
- Call selected model provider
- Stream response
- Parse patch result
- Save execution result
- Report progress to activity log

## Storage Layer

v1.0 recommendation:

```text
SQLite local database
```

Use SQLite instead of only localStorage before v1.0 because cards, logs, prompts, patches, and outputs can become large.

---

# Suggested Folder Structure

```text
src/
  app/
    App.tsx
    routes.tsx

  components/
    board/
    cards/
    drawer/
    sidebar/
    skills/
    models/
    workspace/
    review/
    diff/
    logs/
    settings/

  domain/
    types.ts
    boardRules.ts
    boardService.ts
    transitionService.ts
    promptBuilder.ts
    safetyPolicy.ts
    reviewService.ts
    executionModes.ts

  agent/
    agentRunner.ts
    providers/
      modelProvider.ts
      openAiProvider.ts
      anthropicProvider.ts
      googleProvider.ts
      customProvider.ts
    patch/
      patchParser.ts
      patchValidator.ts
      patchApplyService.ts

  desktop/
    fileSystemBridge.ts
    gitBridge.ts
    commandRunner.ts
    secureKeyStore.ts

  storage/
    database.ts
    repositories/
      workspaceRepository.ts
      cardRepository.ts
      skillRepository.ts
      modelProfileRepository.ts
      activityLogRepository.ts

  data/
    seed.ts

  styles/
```

---

# Core Data Types

## Workspace

```ts
export interface Workspace {
  id: string;
  name: string;
  repoPath?: string;
  defaultModelProfileId?: string;
  defaultAgentProfileId?: string;
  allowedEditableFolders: string[];
  blockedFilePatterns: string[];
  testCommand?: string;
  buildCommand?: string;
  createdAt: string;
  updatedAt: string;
}
```

## KanbanCard

```ts
export interface KanbanCard {
  id: string;
  workspaceId: string;
  columnId: BoardColumnId;
  title: string;
  description: string;
  skillPresetIds: string[];
  modelProfileId?: string;
  agentProfileId?: string;
  executionMode: ExecutionMode;
  targetFiles: string[];
  targetFolders: string[];
  relatedLinks: string[];
  extraContext: string;
  safetySettings: SafetySettings;
  reviewChecklist: ReviewChecklist;
  resultSummary?: string;
  patchText?: string;
  testOutput?: string;
  buildOutput?: string;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## BoardColumnId

```ts
export type BoardColumnId =
  | 'my-skill'
  | 'my-plan'
  | 'skill-used'
  | 'start-implement'
  | 'in-process'
  | 'in-review'
  | 'successfully';
```

## ExecutionMode

```ts
export type ExecutionMode =
  | 'plan-only'
  | 'suggest-patch'
  | 'apply-patch'
  | 'apply-and-run-test'
  | 'apply-and-commit'
  | 'apply-and-pr';
```

---

# v1.0 Definition of Done

The app reaches v1.0 when a user can do this full flow safely:

1. Create a workspace.
2. Set repo path.
3. Create or select skill.md.
4. Create a plan card.
5. Assign skill and model.
6. Move card to Start Implement.
7. Preview final prompt.
8. Run AI in Suggest Patch mode.
9. Review generated diff.
10. Apply patch with backup.
11. Run test command.
12. Move to In Review.
13. Approve checklist.
14. Commit changes.
15. Move to Successfully.
16. Reopen app and see full history preserved.

---

# Post v1.0 Ideas

These should not block v1.0.

- [ ] Multi-agent workflow.
- [ ] Agent dependency graph.
- [ ] Team collaboration.
- [ ] Cloud sync.
- [ ] Plugin system.
- [ ] MCP integration.
- [ ] GitHub issue sync.
- [ ] Jira/Linear sync.
- [ ] Voice command.
- [ ] Visual workflow builder.
- [ ] Agent performance analytics.
- [ ] Cost tracking per model.
- [ ] Token usage dashboard.
- [ ] Prompt version history.
- [ ] Skill marketplace.

---

# Product Principle

Do not let the agent become the boss.

The user should always control:

- what context is used
- what skill is applied
- which model runs
- whether files are edited
- whether tests are executed
- whether commits are made
- whether work is considered complete

The agent is the worker.  
The Kanban board is the command room.
