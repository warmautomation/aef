# AEF - Agent Event Format

Vendor-neutral event schema for AI agent execution (Claude Code, Codex, Gemini, ReAct agents, etc.).

## Overview

AEF provides a common interchange format for AI agent events, enabling:
- Unified visualization across different agent frameworks
- Cross-agent analysis and comparison
- Tool-agnostic event processing

## Installation

```bash
bun add @warmautomation/aef
```

## Usage

### CLI

```bash
# Validate an AEF file
bun aef validate logs/traces.jsonl

# Convert ReActPOC traces to AEF
bun aef convert --adapter reactpoc logs/belief_*.jsonl -o output.jsonl

# Convert Claude Code logs to AEF
bun aef convert --adapter claude-code ~/.claude/projects/*/*.jsonl -o output.jsonl
```

### Library

```typescript
import { validateAEFEntry, reactpocAdapter, claudeCodeAdapter } from '@warmautomation/aef';

// Validate an entry
const result = validateAEFEntry(entry);
if (!result.valid) {
  console.error(result.errors);
}

// Transform events
for await (const aefEntry of reactpocAdapter.parse(lines)) {
  console.log(aefEntry);
}
```

## Specification

See [docs/AEF-spec-v0.1.md](docs/AEF-spec-v0.1.md) for the full specification.

## Examples

The `examples/` directory contains reference implementations:

- **[warmhub-viewer](examples/warmhub-viewer/)** - Viewer plugin for WarmHub belief-conditioned agents
  - Demonstrates custom entry rendering
  - Shows aggregation views (sparklines, waterfall charts)
  - Includes full plugin development guide

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
bun aef validate <file>
```

## License

MIT
