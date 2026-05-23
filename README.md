# kanban-agent

Desktop Kanban control panel prototype for AI agent workflows.

## Run

```powershell
npm install
npm run dev
```

For browser-only UI development:

```powershell
npm run dev:web
```

## Current Prototype

- Electron + React + TypeScript scaffold
- Seven fixed workflow columns
- Local-first workspace state with seed data
- Card create, edit, duplicate, delete
- Native drag/drop between columns
- Skill preset CRUD
- Model profile CRUD
- Agent profile CRUD with default skills, model, and execution mode
- Workspace settings for branch, allowed folders, blocked file patterns, test command, and build command
- Card detail drawer with agent context, project context, safety settings, review checklist, result fields, and activity log
- Two-step fake runner from Start Implement to In Process to In Review
- Provider interface scaffolding for OpenAI, Anthropic, Google, Local, and Custom API
- Generated system/user/final prompt preview from card, skills, model, workspace, and safety context
- Plan Only dry-run path that saves output to review without editing files
- Masked API key placeholder field and structural connection-test button
- Electron secure key bridge using `safeStorage`; secrets are kept out of localStorage
- OpenAI-compatible Plan Only calls for OpenAI and Custom API profiles when a secure key is stored
- Streamed Plan Only chunks are appended to the card activity log
- Repo folder selection and inspection through the Electron bridge
- Git status summary with branch, dirty state, and changed files
- Safety-aware file tree that blocks configured patterns and outside-allowed folders
- Attached file context loader for selected card target files

Anthropic and Google provider modules are scaffolded, but their real API call formats still need provider-specific implementation.
