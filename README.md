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

No real AI API calls are implemented yet.
