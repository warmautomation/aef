# ALF (Agent Log Format) Implementation Plan

## Overview

Implement a normalized log format specification (ALF v0.1) to enable cross-framework visualization and analysis for AI coding agents. This plan covers creating the standalone specification document, JSON Schema validation, and adapters for ReActPOC and Claude Code log formats.

## Repository Structure

```
alf/
├── docs/
│   ├── plan.md              # This file
│   └── ALF-spec-v0.1.md     # Standalone specification
├── src/
│   ├── index.ts             # Public exports
│   ├── types.ts             # TypeScript types
│   ├── validator.ts         # Validation utilities
│   ├── cli.ts               # CLI tool
│   ├── schema/
│   │   └── core.schema.json # JSON Schema
│   ├── adapters/
│   │   ├── index.ts         # Adapter exports
│   │   ├── adapter.ts       # Base adapter interface
│   │   ├── reactpoc.ts      # ReActPOC adapter
│   │   └── claude-code.ts   # Claude Code adapter
│   └── __tests__/
│       ├── validator.test.ts
│       └── adapters/
├── package.json
└── tsconfig.json
```

## Current State Analysis

### Existing Formats

**ReActPOC**: Episode-level JSONL in `logs/*.jsonl`
- Structure: `EpisodeResult` with steps, metrics, belief traces
- Contains: questionId, question, goldAnswer, predictedAnswer, status, steps[], metrics, beliefTrace[], beliefMetrics

**Claude Code**: Session-level JSONL in `~/.claude/projects/<project>/<session>.jsonl`
- Entry types: `file-history-snapshot`, `user`, `assistant`
- Assistant messages contain: content blocks (text, tool_use, tool_result), model, usage
- Each entry has: uuid, parentUuid, sessionId, timestamp, type, message

## Desired End State

After implementing this plan:

1. **Standalone ALF specification** exists at `docs/ALF-spec-v0.1.md`
2. **JSON Schema** exists at `src/schema/` for runtime validation
3. **reactpoc-adapter** transforms ReActPOC traces to ALF format
4. **claude-code-adapter** transforms Claude Code logs to ALF format
5. **CLI tool** provides `alf validate` and `alf convert` commands

### Verification

```bash
# Install dependencies
pnpm install

# Validate a log file against ALF schema
pnpm alf validate /path/to/logs/*.jsonl

# Convert ReActPOC trace to ALF
pnpm alf convert --adapter reactpoc /path/to/logs/*.jsonl -o output.jsonl

# Convert Claude Code log to ALF
pnpm alf convert --adapter claude-code ~/.claude/projects/<project>/*.jsonl -o output.jsonl
```

## What We're NOT Doing

- Not building real-time streaming adapters (batch transformation only)
- Not modifying existing trace writers to emit ALF natively
- Not building adapters for Codex, Gemini, or other agents (future work)
- Not building a unified viewer (consumers will import this package)

---

## Phase 0: Specification Document

### Overview

Create a standalone, version-controlled specification document that can be shared independently.

### Changes Required

#### 1. Create Specification Document

**File**: `docs/ALF-spec-v0.1.md`

```markdown
# Agent Log Format (ALF) Specification v0.1

## Abstract

ALF is a normalized log format for AI coding agent traces. It enables cross-framework
visualization and analysis by providing a common schema for session, message, tool,
and extension events.

## Status

Draft - v0.1

## 1. Introduction

### 1.1 Purpose

ALF provides a common interchange format for AI agent logs, enabling:
- Unified visualization across different agent frameworks
- Cross-agent analysis and comparison
- Tool-agnostic log processing

### 1.2 Design Principles

1. **Append-only JSONL** - Streamable, no in-place edits
2. **Core + Extensions** - Required fields + namespaced extensions
3. **Future-proof** - Version field, unknown field tolerance
4. **Tool-agnostic** - No assumptions about rendering context

## 2. Core Schema

### 2.1 Base Entry

Every ALF entry MUST contain these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| v | integer | Yes | Schema version (currently 1) |
| id | string | Yes | Unique entry ID (UUIDv7 or ULID recommended) |
| ts | integer | Yes | Unix timestamp in milliseconds |
| type | string | Yes | Entry type (see Section 3) |
| sid | string | Yes | Session ID - groups related entries |
| pid | string | No | Parent ID - for threading/causality |
| seq | integer | No | Sequence number within session |

### 2.2 Core Entry Types

- `session.start` - Session initialization
- `session.end` - Session completion
- `message` - User/assistant/system message
- `tool.call` - Tool invocation
- `tool.result` - Tool response
- `error` - Error event

[Full schema definitions...]

## 3. Extensions

### 3.1 Namespace Convention

Extensions use dotted namespaces: `<vendor>.<category>.<type>`

Examples:
- `warmhub.belief.query` - Belief state query
- `warmhub.belief.update` - Belief state update
- `warmhub.react.step` - ReAct agent step
- `warmhub.react.episode` - ReAct episode summary

## 4. File Format

**Format**: JSONL (newline-delimited JSON)
- One entry per line
- UTF-8 encoding
- Optional gzip compression (`.jsonl.gz`)

**Naming Convention**:
```
<agent>_<type>_<session-id>_<timestamp>.jsonl
```

## Appendix A: JSON Schema

[Reference to src/schema/core.schema.json]

## Appendix B: Examples

[Complete examples of each entry type]
```

### Success Criteria

- [ ] File exists at `docs/ALF-spec-v0.1.md`
- [ ] Specification is self-contained and readable
- [ ] All core entry types are fully defined

---

## Phase 1: JSON Schema and Types

### Overview

Create JSON Schema files and TypeScript types for validation.

### Changes Required

#### 1. TypeScript Types

**File**: `src/types.ts`

```typescript
// Core ALF entry base type
export interface ALFEntry {
  /** Schema version */
  v: 1;
  /** Entry ID (UUIDv7 or ULID recommended) */
  id: string;
  /** Unix timestamp in milliseconds */
  ts: number;
  /** Entry type (namespaced for extensions) */
  type: string;
  /** Session ID - groups related entries */
  sid: string;
  /** Parent ID - for threading/causality */
  pid?: string;
  /** Sequence number within session */
  seq?: number;
}

// Core entry types
export interface SessionStart extends ALFEntry {
  type: 'session.start';
  agent: string;
  version?: string;
  workspace?: string;
  model?: string;
  meta?: Record<string, unknown>;
}

export interface SessionEnd extends ALFEntry {
  type: 'session.end';
  status: 'complete' | 'error' | 'timeout' | 'user_abort';
  summary?: {
    messages?: number;
    tool_calls?: number;
    duration_ms?: number;
    tokens?: { input: number; output: number };
  };
}

export interface Message extends ALFEntry {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
  tokens?: { input?: number; output?: number; cached?: number };
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ToolCall extends ALFEntry {
  type: 'tool.call';
  tool: string;
  args: Record<string, unknown>;
  call_id?: string;
}

export interface ToolResult extends ALFEntry {
  type: 'tool.result';
  tool: string;
  call_id?: string;
  result: unknown;
  success: boolean;
  duration_ms?: number;
  error?: { code?: string; message: string };
}

export interface ErrorEntry extends ALFEntry {
  type: 'error';
  code?: string;
  message: string;
  stack?: string;
  recoverable?: boolean;
}

export type CoreEntry =
  | SessionStart
  | SessionEnd
  | Message
  | ToolCall
  | ToolResult
  | ErrorEntry;

// Extension: warmhub.belief.*
export interface BeliefQuery extends ALFEntry {
  type: 'warmhub.belief.query';
  query: string;
  snapshot: {
    hypotheses: Array<{ id: string; desc: string; b: number; d: number; u: number }>;
    assertions: number;
    finish_ready: boolean;
    leading?: string;
  };
}

export interface BeliefUpdate extends ALFEntry {
  type: 'warmhub.belief.update';
  assertion: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    source: string;
    content?: string;
    consistent_with?: string[];
    inconsistent_with?: string[];
  };
  deltas?: Array<{ hyp: string; db: number; dd: number; du: number }>;
  snapshot_after?: BeliefQuery['snapshot'];
}

// Extension: warmhub.react.*
export interface ReactStep extends ALFEntry {
  type: 'warmhub.react.step';
  step: number;
  thought?: string;
  action: string;
  action_arg?: string;
  observation?: string;
  latency_ms?: number;
  tokens?: { input: number; output: number };
}

export interface ReactEpisode extends ALFEntry {
  type: 'warmhub.react.episode';
  question_id: string;
  question: string;
  gold_answer: string;
  predicted_answer?: string;
  status: 'success' | 'max_steps' | 'error' | 'parse_failure' | 'timeout';
  metrics: {
    em: number;
    f1: number;
    tool_calls: number;
    total_latency_ms: number;
    total_tokens: number;
  };
  belief_metrics?: {
    hypothesis_reversals: number;
    final_confidence: number;
    uncertainty_reduction: number;
    finish_gate_respected: boolean;
  };
}

export type ExtensionEntry = BeliefQuery | BeliefUpdate | ReactStep | ReactEpisode;
export type AnyALFEntry = CoreEntry | ExtensionEntry;
```

#### 2. JSON Schema

**File**: `src/schema/core.schema.json`

Full JSON Schema for validating ALF entries (see original plan for complete schema).

#### 3. Validator

**File**: `src/validator.ts`

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { AnyALFEntry } from './types.js';
import coreSchema from './schema/core.schema.json' assert { type: 'json' };

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateCore = ajv.compile(coreSchema);

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateALFEntry(entry: unknown): ValidationResult {
  const valid = validateCore(entry);
  if (valid) return { valid: true };
  return {
    valid: false,
    errors: validateCore.errors?.map(e => `${e.instancePath}: ${e.message}`) ?? [],
  };
}

export async function validateALFFile(
  filePath: string
): Promise<{ valid: boolean; lineErrors: Map<number, string[]> }> {
  // Implementation: read file line by line, validate each entry
}
```

### Success Criteria

- [ ] Types compile: `pnpm typecheck`
- [ ] Schema validates test fixtures
- [ ] `pnpm alf validate` command works

---

## Phase 2: ReActPOC Adapter

### Overview

Transform ReActPOC episode traces into ALF format.

### Changes Required

#### 1. Adapter Interface

**File**: `src/adapters/adapter.ts`

```typescript
import type { AnyALFEntry } from '../types.js';

export interface LogAdapter<TSource = unknown> {
  readonly id: string;
  readonly name: string;
  readonly patterns: string[];
  parse(source: TSource): AsyncIterable<AnyALFEntry>;
}

export function generateId(): string {
  const ts = Date.now().toString(16).padStart(12, '0');
  const rand = Math.random().toString(16).slice(2, 10);
  return `${ts}-${rand}`;
}
```

#### 2. ReActPOC Adapter

**File**: `src/adapters/reactpoc.ts`

Transforms episode-centric format to event-centric ALF entries:
- Episode → session.start + messages + steps + session.end
- Steps → warmhub.react.step + tool.call + tool.result
- Belief entries → warmhub.belief.query / warmhub.belief.update

### Success Criteria

- [ ] Adapter compiles
- [ ] Transforms ReActPOC traces correctly
- [ ] Output validates against schema

---

## Phase 3: Claude Code Adapter

### Overview

Transform Claude Code session logs into ALF format.

### Changes Required

#### 1. Claude Code Types

**File**: `src/adapters/claude-code-types.ts`

Types for Claude Code log entries (user, assistant, file-history-snapshot).

#### 2. Claude Code Adapter

**File**: `src/adapters/claude-code.ts`

Transforms event-centric Claude Code logs:
- First entry → session.start
- user entries → message (role: user/system)
- assistant entries → message + tool.call entries
- End of file → session.end with summary

### Success Criteria

- [ ] Adapter compiles
- [ ] Transforms Claude Code logs correctly
- [ ] Session boundaries detected properly

---

## Phase 4: CLI Tool

### Overview

Command-line interface for validation and conversion.

### Changes Required

**File**: `src/cli.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { validateALFFile } from './validator.js';
import { reactpocAdapter } from './adapters/reactpoc.js';
import { claudeCodeAdapter } from './adapters/claude-code.js';

const program = new Command();

program
  .name('alf')
  .description('Agent Log Format utilities')
  .version('0.1.0');

program
  .command('validate <file>')
  .description('Validate an ALF JSONL file')
  .action(async (file) => { /* ... */ });

program
  .command('convert <file>')
  .description('Convert a log file to ALF format')
  .option('-a, --adapter <name>', 'Adapter (reactpoc, claude-code)', 'reactpoc')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (file, options) => { /* ... */ });

program.parse();
```

### Success Criteria

- [ ] `pnpm alf validate` works
- [ ] `pnpm alf convert --adapter reactpoc` works
- [ ] `pnpm alf convert --adapter claude-code` works

---

## Testing Strategy

### Unit Tests

- `src/__tests__/validator.test.ts` - Schema validation
- `src/__tests__/adapters/reactpoc.test.ts` - ReActPOC transformation
- `src/__tests__/adapters/claude-code.test.ts` - Claude Code transformation

### Integration Tests

- Transform real trace files
- Validate output against schema
- Test CLI commands end-to-end

---

## References

- Original research: ReActPOC `specs/shared/ALF-agent-log-format-spec.md`
- ReActPOC types: `src/agent/types.ts`, `src/hotpotqa/types.ts`
- Claude Code logs: `~/.claude/projects/<project>/*.jsonl`
