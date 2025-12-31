# ALF - Agent Log Format

## What is ALF?

ALF (Agent Log Format) is a normalized JSONL-based log format specification designed to enable cross-framework visualization and analysis of AI coding agent traces. Different AI agents (Claude Code, Codex, Gemini CLI, ReAct agents, etc.) each produce logs in their own proprietary formats, making it difficult to build unified tooling for visualization, debugging, and analysis. ALF solves this by defining a common schema with core entry types (`session.start`, `session.end`, `message`, `tool.call`, `tool.result`, `error`) that capture the essential structure of any agent conversation, plus a namespaced extension system (`<vendor>.<category>.<type>`) for domain-specific data like belief states or ReAct reasoning steps. The project provides adapter implementations that transform native log formats into ALF, enabling any consumer (TUI viewers, web dashboards, analysis scripts) to work with logs from any supported agent through a single, well-typed interface.

## Project Structure

- `docs/plan.md` - Implementation plan with all phases
- `docs/ALF-spec-v0.1.md` - Standalone specification (to be written)
- `src/types.ts` - TypeScript type definitions
- `src/validator.ts` - JSON Schema validation
- `src/adapters/` - Format adapters (reactpoc, claude-code)
- `src/cli.ts` - CLI tool (`bun alf validate`, `bun alf convert`)

## Key Commands

```bash
bun install          # Install dependencies
bun test             # Run tests
bun alf validate     # Validate ALF file
bun alf convert      # Convert logs to ALF format
```
