# ALF - Agent Log Format

Normalized log format for AI coding agents (Claude Code, Codex, Gemini, ReAct agents, etc.).

## Overview

ALF provides a common interchange format for AI agent logs, enabling:
- Unified visualization across different agent frameworks
- Cross-agent analysis and comparison
- Tool-agnostic log processing

## Installation

```bash
bun add @warmautomation/alf
```

## Usage

### CLI

```bash
# Validate an ALF file
bun alf validate logs/traces.jsonl

# Convert ReActPOC traces to ALF
bun alf convert --adapter reactpoc logs/belief_*.jsonl -o output.jsonl

# Convert Claude Code logs to ALF
bun alf convert --adapter claude-code ~/.claude/projects/*/*.jsonl -o output.jsonl
```

### Library

```typescript
import { validateALFEntry, reactpocAdapter, claudeCodeAdapter } from '@warmautomation/alf';

// Validate an entry
const result = validateALFEntry(entry);
if (!result.valid) {
  console.error(result.errors);
}

// Transform logs
for await (const alfEntry of reactpocAdapter.parse(lines)) {
  console.log(alfEntry);
}
```

## Specification

See [docs/ALF-spec-v0.1.md](docs/ALF-spec-v0.1.md) for the full specification.

## Supported Adapters

| Adapter | Source Format | Status |
|---------|---------------|--------|
| `reactpoc` | ReActPOC belief traces | Planned |
| `claude-code` | Claude Code sessions | Planned |
| `codex` | Codex CLI | Future |
| `gemini` | Gemini CLI | Future |

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun typecheck

# Run CLI in dev mode
bun alf validate <file>
```

## License

MIT
