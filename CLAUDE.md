# AEF - Agent Event Format

## What is AEF?

AEF (Agent Event Format) is a vendor-neutral event schema for AI agent execution, designed to enable cross-framework visualization and analysis of AI coding agent traces. Different AI agents (Claude Code, Codex, Gemini CLI, ReAct agents, etc.) each produce logs in their own proprietary formats, making it difficult to build unified tooling for visualization, debugging, and analysis. AEF solves this by defining a common schema with core entry types (`session.start`, `session.end`, `message`, `tool.call`, `tool.result`, `error`) that capture the essential structure of any agent conversation, plus a namespaced extension system (`<vendor>.<category>.<type>`) for domain-specific data like belief states or ReAct reasoning steps. The project provides adapter implementations that transform native log formats into AEF, enabling any consumer (TUI viewers, web dashboards, analysis scripts) to work with logs from any supported agent through a single, well-typed interface.

## Project Structure

- `docs/plan.md` - Implementation plan with all phases
- `docs/AEF-spec-v0.1.md` - Standalone specification (to be written)
- `src/types.ts` - TypeScript type definitions
- `src/validator.ts` - JSON Schema validation
- `src/adapters/` - Format adapters (reactpoc, claude-code)
- `src/cli.ts` - CLI tool (`bun aef validate`, `bun aef convert`)

## Key Commands

```bash
bun install          # Install dependencies
bun test             # Run tests
bun aef validate     # Validate AEF file
bun aef convert      # Convert logs to AEF format
```

## Work Tracking with Beads

**All work in this project MUST be tracked using beads.** Beads is the required issue tracker with first-class dependency support.

### Core Philosophy: Nothing Falls Through Cracks

- Every objective, task, and discovered issue becomes a bead
- Dependencies are explicit and enforced
- Work persists across sessions
- No work is lost or forgotten

### Essential Commands

```bash
bd ready              # Show work ready to start
bd show <id>          # View bead details
bd create --title="..." --type=task --priority=2  # Create bead
bd update <id> --status=in_progress  # Start work
bd close <id>         # Complete work
bd sync               # Sync with git
```

### Session Close Protocol

Before saying "done", you MUST:
```bash
git status            # Check changes
git add <files>       # Stage code
bd sync               # Sync beads
git commit -m "..."   # Commit
git push              # Push
```

## Harness System

For complex multi-agent workflows, install the `warmhub-orchestration` plugin:

```bash
claude plugin install warmhub-orchestration
```

This provides `/harness`, `/harness-work`, `/harness-status`, and related commands for coordinated multi-agent execution with beads integration.
