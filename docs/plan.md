# AEF (Agent Event Format) Implementation Plan

## Overview

Implement a normalized log format specification (AEF v0.1) to enable cross-framework visualization and analysis for AI coding agents. AEF aims to become the common interchange format that enables unified tooling across the fragmented agent ecosystem.

## Strategic Principles

### 1. Lean Hard into Adapters
Adapters are the primary adoption vector. Each adapter brings its community and serves as a forcing function for schema robustness.

| Adapter | Priority | Rationale |
|---------|----------|-----------|
| Claude Code | P0 | High popularity, reference implementation |
| Codex CLI | P1 | OpenAI ecosystem, validates cross-vendor story |
| Gemini CLI | P1 | Google ecosystem, growing adoption |
| LangChain/LangGraph | P2 | Massive community, complex traces |
| ReActPOC | P2 | Internal dogfooding, belief state extension test |

### 2. Minimal Core, Extensible Schema
Core types capture universal agent concepts only. Domain-specific semantics (belief states, ReAct reasoning, planning) live in namespaced extensions.

**Core types**: `session.start`, `session.end`, `message`, `tool.call`, `tool.result`, `error`

**Extensions**: `warmhub.belief.*`, `warmhub.react.*`, `langchain.chain.*`, etc.

Extensions are documented schemas that validate via namespace convention, not compile-time types in the core package.

### 3. Streamable-First
JSONL append-only format enables:
- `tail -f` watching
- UNIX pipeline composition (`cat log.jsonl | jq | alf validate`)
- Incremental processing without loading full files

Adapter interfaces must support streaming from day one, even if v0.1 implementations are batch-oriented.

### 4. OpenTelemetry as Cousin
AEF and OTel serve different purposes but should interoperate cleanly.

| AEF Concept | OTel Equivalent |
|-------------|-----------------|
| `sid` (session) | Trace ID |
| `id` (entry) | Span ID |
| `pid` (parent) | Parent Span ID |
| `tool.call` → `tool.result` | Span (kind=CLIENT) |
| `message` | Event / Log |
| Extension fields | Span Attributes |

Future work: `alf export --format otlp` for OTel collector ingestion.

---

## Repository Structure

```
aef/
├── docs/
│   ├── plan.md                 # This file
│   ├── AEF-spec-v0.1.md        # Standalone specification
│   ├── extensions.md           # Extension schemas (warmhub, etc.)
│   └── otel-mapping.md         # OTel interoperability guide
├── src/
│   ├── index.ts                # Public exports
│   ├── types.ts                # Core TypeScript types only
│   ├── validator.ts            # Validation utilities
│   ├── cli.ts                  # CLI tool
│   ├── schema/
│   │   └── core.schema.json    # Core JSON Schema
│   ├── adapters/
│   │   ├── index.ts            # Adapter exports
│   │   ├── adapter.ts          # Base adapter interface
│   │   ├── claude-code.ts      # Claude Code adapter
│   │   ├── codex.ts            # Codex CLI adapter
│   │   ├── gemini.ts           # Gemini CLI adapter
│   │   └── reactpoc.ts         # ReActPOC adapter
│   └── __tests__/
│       ├── validator.test.ts
│       ├── extensions.test.ts  # Extension validation tests
│       └── adapters/
├── package.json
└── tsconfig.json
```

---

## Current State Analysis

### Existing Formats

**Claude Code**: Session-level JSONL in `~/.claude/projects/<project>/<session>.jsonl`
- Entry types: `file-history-snapshot`, `user`, `assistant`
- Assistant messages contain: content blocks (text, tool_use, tool_result), model, usage
- Each entry has: uuid, parentUuid, sessionId, timestamp, type, message

**Codex CLI**: TBD - requires format analysis

**Gemini CLI**: TBD - requires format analysis

**ReActPOC**: Episode-level JSONL in `logs/*.jsonl`
- Structure: `EpisodeResult` with steps, metrics, belief traces
- Contains: questionId, question, goldAnswer, predictedAnswer, status, steps[], metrics, beliefTrace[], beliefMetrics

---

## Desired End State

After implementing this plan:

1. **Standalone AEF specification** exists at `docs/AEF-spec-v0.1.md`
2. **Extension documentation** exists at `docs/extensions.md` with warmhub schemas as examples
3. **JSON Schema** validates core types; extensions validate by namespace pattern
4. **Adapters** for Claude Code, Codex CLI, Gemini CLI, ReActPOC
5. **CLI tool** provides `alf validate`, `alf convert`, `alf info` commands
6. **OTel mapping** documented for future exporter work

### Verification

```bash
# Install dependencies
bun install

# Validate a log file against AEF schema
bun aef validate /path/to/logs/*.jsonl

# Convert Claude Code log to AEF
bun aef convert --adapter claude-code ~/.claude/projects/<project>/*.jsonl

# Convert with streaming (future)
tail -f session.jsonl | bun aef convert --adapter claude-code --streaming

# Inspect log metadata
bun aef info /path/to/log.jsonl
```

---

## What We're NOT Doing (v0.1)

- Not modifying existing trace writers to emit AEF natively
- Not building a unified viewer (consumers import this package)
- Not building OTel exporters (mapping documented for future work)
- Not requiring adapters to support streaming (interface allows it, implementation is batch)

---

## Phase 0: Specification Document

### Overview

Create a standalone, version-controlled specification that can be shared independently.

### Deliverables

**File**: `docs/AEF-spec-v0.1.md`

```markdown
# Agent Event Format (AEF) Specification v0.1

## Abstract

AEF is a normalized log format for AI agent traces. It enables cross-framework
visualization and analysis by providing a common schema for session, message,
tool, and extension events.

## Status

Draft - v0.1

## 1. Introduction

### 1.1 Purpose

AEF provides a common interchange format for AI agent logs, enabling:
- Unified visualization across different agent frameworks
- Cross-agent analysis and comparison
- Tool-agnostic log processing
- Pipeline composition with UNIX tools

### 1.2 Design Principles

1. **Append-only JSONL** - Streamable, no in-place edits
2. **Core + Extensions** - Minimal required fields + namespaced extensions
3. **Future-proof** - Version field, unknown field tolerance
4. **Tool-agnostic** - No assumptions about rendering context
5. **OTel-compatible** - Clear mapping to OpenTelemetry concepts

## 2. Core Schema

### 2.1 Base Entry

Every AEF entry MUST contain these fields:

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

[Full schema definitions for each type...]

## 3. Extensions

### 3.1 Namespace Convention

Extensions use dotted namespaces: `<vendor>.<category>.<type>`

Reserved vendor prefixes:
- `alf.*` - Official AEF extensions
- `otel.*` - OpenTelemetry compatibility

Examples:
- `warmhub.belief.query` - Belief state query
- `warmhub.react.step` - ReAct agent step
- `langchain.chain.start` - LangChain chain execution

### 3.2 Extension Validation

Extensions MUST include all base entry fields. Additional fields are
validated against extension-specific schemas when available, or passed
through when schema is unknown.

## 4. File Format

**Format**: JSONL (newline-delimited JSON)
- One entry per line
- UTF-8 encoding
- No trailing commas
- Optional gzip compression (`.jsonl.gz`)

**Naming Convention** (recommended):
```
<agent>_<session-id>_<timestamp>.aef.jsonl
```

## 5. OpenTelemetry Mapping

See Appendix B for detailed mapping between AEF and OTel concepts.

## Appendix A: JSON Schema

[Reference to src/schema/core.schema.json]

## Appendix B: OpenTelemetry Mapping

[Detailed mapping table and conversion rules]

## Appendix C: Examples

[Complete examples of each entry type]
```

### Success Criteria

- [ ] File exists at `docs/AEF-spec-v0.1.md`
- [ ] Specification is self-contained and readable
- [ ] All core entry types are fully defined
- [ ] Extension namespace convention is clear
- [ ] OTel mapping is documented

---

## Phase 1: Core Schema and Types

### Overview

Create JSON Schema and TypeScript types for **core types only**. Extensions are documented separately and validated by pattern.

### Deliverables

#### 1. Core TypeScript Types

**File**: `src/types.ts`

```typescript
/**
 * AEF Core Type Definitions
 *
 * Extensions are NOT defined here - they use the base AEFEntry interface
 * and are validated by namespace pattern matching.
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Base AEF entry - all entries must have these fields
 */
export interface AEFEntry {
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

/**
 * Session start entry
 */
export interface SessionStart extends AEFEntry {
  type: 'session.start';
  agent: string;
  version?: string;
  workspace?: string;
  model?: string;
  meta?: Record<string, unknown>;
}

/**
 * Session end entry
 */
export interface SessionEnd extends AEFEntry {
  type: 'session.end';
  status: 'complete' | 'error' | 'timeout' | 'user_abort';
  summary?: {
    messages?: number;
    tool_calls?: number;
    duration_ms?: number;
    tokens?: { input: number; output: number };
  };
}

/**
 * Message entry (user, assistant, or system)
 */
export interface Message extends AEFEntry {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
  tokens?: { input?: number; output?: number; cached?: number };
}

/**
 * Content block types
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * Tool call entry
 */
export interface ToolCall extends AEFEntry {
  type: 'tool.call';
  tool: string;
  args: Record<string, unknown>;
  call_id?: string;
}

/**
 * Tool result entry
 */
export interface ToolResult extends AEFEntry {
  type: 'tool.result';
  tool: string;
  call_id?: string;
  result: unknown;
  success: boolean;
  duration_ms?: number;
  error?: { code?: string; message: string };
}

/**
 * Error entry
 */
export interface ErrorEntry extends AEFEntry {
  type: 'error';
  code?: string;
  message: string;
  stack?: string;
  recoverable?: boolean;
}

/**
 * Union of all core entry types
 */
export type CoreEntry =
  | SessionStart
  | SessionEnd
  | Message
  | ToolCall
  | ToolResult
  | ErrorEntry;

/**
 * Type guard for core entry types
 */
export function isCoreEntry(entry: AEFEntry): entry is CoreEntry {
  return [
    'session.start',
    'session.end',
    'message',
    'tool.call',
    'tool.result',
    'error'
  ].includes(entry.type);
}

/**
 * Type guard for extension entries (namespaced types)
 */
export function isExtensionEntry(entry: AEFEntry): boolean {
  return entry.type.includes('.') && !isCoreEntry(entry);
}
```

#### 2. JSON Schema

**File**: `src/schema/core.schema.json`

Schema validates:
- Base entry fields (required for all)
- Core type-specific fields
- Extension entries pass if they have valid base fields and namespaced type

#### 3. Validator

**File**: `src/validator.ts`

```typescript
import Ajv from 'ajv';
import type { AEFEntry, CoreEntry } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  entryType: 'core' | 'extension' | 'invalid';
}

export function validateAEFEntry(entry: unknown): ValidationResult {
  // 1. Validate base fields
  // 2. If core type, validate type-specific schema
  // 3. If extension (namespaced), validate base fields only
  // 4. Return result with entry classification
}

export async function* validateAEFStream(
  lines: AsyncIterable<string>
): AsyncGenerator<{ line: number; result: ValidationResult }> {
  // Streaming validation for large files
}
```

### Success Criteria

- [ ] Types compile: `bun typecheck`
- [ ] Core entries validate against schema
- [ ] Extension entries with valid base fields pass validation
- [ ] Extension entries are classified correctly
- [ ] Streaming validator works with `AsyncIterable`

---

## Phase 2: Claude Code Adapter

### Overview

Transform Claude Code session logs into AEF format. This is the highest-value adapter due to Claude Code's popularity.

### Deliverables

#### 1. Adapter Interface

**File**: `src/adapters/adapter.ts`

```typescript
import type { AEFEntry } from '../types.js';

export interface AdapterOptions {
  /** Generate sequential IDs instead of random */
  sequentialIds?: boolean;
  /** Include source line numbers in output */
  includeSourceRef?: boolean;
}

export interface LogAdapter<TSource = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** File patterns this adapter handles */
  readonly patterns: string[];

  /** Parse source into AEF entries (batch) */
  parse(source: TSource, options?: AdapterOptions): AsyncIterable<AEFEntry>;

  /** Parse streaming input (optional, for streamable-first) */
  parseStream?(
    stream: AsyncIterable<string>,
    options?: AdapterOptions
  ): AsyncIterable<AEFEntry>;
}

export function generateId(): string {
  // UUIDv7-like: timestamp prefix + random suffix
  const ts = Date.now().toString(16).padStart(12, '0');
  const rand = crypto.randomUUID().slice(0, 8);
  return `${ts}-${rand}`;
}
```

#### 2. Claude Code Adapter

**File**: `src/adapters/claude-code.ts`

Transforms Claude Code logs:
- First entry → `session.start`
- `user` entries → `message` (role: user)
- `assistant` entries → `message` + extracted `tool.call` entries
- Tool results in content → `tool.result` entries
- End of file → `session.end` with computed summary

### Success Criteria

- [ ] Adapter compiles
- [ ] Transforms real Claude Code logs correctly
- [ ] Session boundaries detected properly
- [ ] Tool calls extracted from content blocks
- [ ] Output validates against AEF schema

---

## Phase 3: Codex CLI Adapter

### Overview

Transform Codex CLI logs into AEF format. Validates cross-vendor story.

### Research Required

- [ ] Locate Codex CLI log format documentation
- [ ] Analyze sample log files
- [ ] Document format in `docs/formats/codex.md`

### Deliverables

**File**: `src/adapters/codex.ts`

### Success Criteria

- [ ] Format documented
- [ ] Adapter compiles
- [ ] Transforms Codex logs correctly
- [ ] Output validates against AEF schema

---

## Phase 4: CLI Tool

### Overview

Command-line interface for validation, conversion, and inspection.

### Deliverables

**File**: `src/cli.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('alf')
  .description('Agent Event Format utilities')
  .version('0.1.0');

program
  .command('validate <file...>')
  .description('Validate AEF JSONL file(s)')
  .option('--strict', 'Fail on extension entries without schema')
  .option('--quiet', 'Only output errors')
  .action(async (files, options) => { /* ... */ });

program
  .command('convert <file>')
  .description('Convert a log file to AEF format')
  .requiredOption('-a, --adapter <name>', 'Adapter (claude-code, codex, gemini, reactpoc)')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('--validate', 'Validate output entries')
  .action(async (file, options) => { /* ... */ });

program
  .command('info <file>')
  .description('Display log file metadata')
  .action(async (file) => {
    // Show: session count, entry counts by type, time range, agents
  });

program
  .command('adapters')
  .description('List available adapters')
  .action(() => { /* ... */ });

program.parse();
```

### Success Criteria

- [ ] `bun aef validate` works with helpful output
- [ ] `bun aef convert --adapter claude-code` works
- [ ] `bun aef info` shows useful metadata
- [ ] `bun aef adapters` lists available adapters
- [ ] Exit codes are correct (0 success, 1 error)

---

## Phase 5: Gemini CLI Adapter

### Overview

Transform Gemini CLI logs into AEF format.

### Research Required

- [ ] Locate Gemini CLI log format documentation
- [ ] Analyze sample log files
- [ ] Document format in `docs/formats/gemini.md`

### Deliverables

**File**: `src/adapters/gemini.ts`

---

## Phase 6: ReActPOC Adapter + Extension Tests

### Overview

Transform ReActPOC traces and use them to validate the extension model.

### Deliverables

#### 1. Extension Documentation

**File**: `docs/extensions.md`

```markdown
# AEF Extension Schemas

This document defines extension schemas for domain-specific agent concepts.
Extensions serve as examples for implementing custom schemas.

## warmhub.belief.*

Belief state tracking for hypothesis-driven agents.

### warmhub.belief.query

Captures a belief state query with hypothesis snapshot.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | The question being evaluated |
| snapshot | object | Yes | Current belief state |
| snapshot.hypotheses | array | Yes | List of hypotheses with B/D/U values |
| snapshot.assertions | integer | Yes | Number of assertions processed |
| snapshot.finish_ready | boolean | Yes | Whether finish gate is satisfied |
| snapshot.leading | string | No | ID of leading hypothesis |

### warmhub.belief.update

Captures a belief state update from new evidence.

[Schema definition...]

## warmhub.react.*

ReAct agent step tracking.

### warmhub.react.step

[Schema definition...]

### warmhub.react.episode

[Schema definition...]
```

#### 2. ReActPOC Adapter

**File**: `src/adapters/reactpoc.ts`

Transforms episode-centric format to event-centric AEF:
- Episode → `session.start` + messages + steps + `session.end`
- Steps → `warmhub.react.step` + `tool.call` + `tool.result`
- Belief entries → `warmhub.belief.query` / `warmhub.belief.update`

#### 3. Extension Validation Tests

**File**: `src/__tests__/extensions.test.ts`

```typescript
describe('Extension validation', () => {
  it('validates warmhub.belief.query entries', () => {
    // Entries should pass base validation
    // Additional warmhub-specific validation (optional schema)
  });

  it('passes unknown extensions with valid base fields', () => {
    // Extensions without registered schema should still validate base
  });

  it('classifies entries correctly', () => {
    // Core vs extension classification
  });
});
```

### Success Criteria

- [ ] Extension schemas documented
- [ ] ReActPOC adapter produces valid extension entries
- [ ] Extension entries validate correctly
- [ ] Unknown extensions pass with valid base fields
- [ ] Tests cover extension model edge cases

---

## Testing Strategy

### Test Runner: Bun

Use Bun's native test runner (Jest-compatible API, zero dependencies).

**package.json scripts**:
```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

**Commands**:
```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Coverage report
bun test --coverage

# Run specific test file
bun test src/__tests__/validator.test.ts

# Run tests matching pattern
bun test --test-name-pattern "extension"
```

### Unit Tests

- `src/__tests__/validator.test.ts` - Core schema validation
- `src/__tests__/extensions.test.ts` - Extension validation model
- `src/__tests__/adapters/*.test.ts` - Each adapter

**Example test structure**:
```typescript
// src/__tests__/validator.test.ts
import { describe, it, expect } from 'bun:test';
import { validateAEFEntry } from '../validator';

describe('validateAEFEntry', () => {
  it('validates a valid session.start entry', () => {
    const entry = {
      v: 1,
      id: '0194a1b2c3d4-e5f6',
      ts: 1704067200000,
      type: 'session.start',
      sid: 'session-abc123',
      agent: 'claude-code',
    };
    const result = validateAEFEntry(entry);
    expect(result.valid).toBe(true);
    expect(result.entryType).toBe('core');
  });

  it('rejects entry missing required fields', () => {
    const entry = { v: 1, type: 'message' };
    const result = validateAEFEntry(entry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('/id: Required');
  });

  it('passes unknown extensions with valid base fields', () => {
    const entry = {
      v: 1,
      id: '0194a1b2c3d4-e5f6',
      ts: 1704067200000,
      type: 'acme.custom.widget',
      sid: 'session-abc123',
      customField: 'allowed',
    };
    const result = validateAEFEntry(entry);
    expect(result.valid).toBe(true);
    expect(result.entryType).toBe('extension');
  });
});
```

### Integration Tests

- Transform real trace files from each format
- Validate all output against schema
- Test CLI commands end-to-end
- Test streaming validation with large files

**CLI integration test example**:
```typescript
// src/__tests__/cli.test.ts
import { describe, it, expect } from 'bun:test';
import { $ } from 'bun';

describe('alf cli', () => {
  it('validates a valid AEF file', async () => {
    const result = await $`bun src/cli.ts validate fixtures/alf/valid-core.jsonl`.quiet();
    expect(result.exitCode).toBe(0);
  });

  it('converts claude-code logs', async () => {
    const result = await $`bun src/cli.ts convert -a claude-code fixtures/claude-code/simple-session.jsonl`.quiet();
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.toString().trim().split('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });
});
```

### Test Fixtures

```
fixtures/
├── claude-code/
│   ├── simple-session.jsonl
│   └── multi-tool-session.jsonl
├── codex/
│   └── sample.jsonl
├── gemini/
│   └── sample.jsonl
├── reactpoc/
│   └── episode-with-belief.jsonl
└── alf/
    ├── valid-core.jsonl
    ├── valid-extension.jsonl
    └── invalid-*.jsonl
```

### Coverage Requirements

Target: **80% line coverage** for core modules (`types.ts`, `validator.ts`, adapters).

```bash
# Generate coverage report
bun test --coverage

# Coverage output shows:
# - Line coverage per file
# - Uncovered line numbers
# - Overall project coverage
```

---

## Future Work (Post v0.1)

### Adapters
- LangChain/LangGraph adapter
- AutoGPT adapter
- Custom agent SDK

### OTel Integration
- `alf export --format otlp` exporter
- OTel collector receiver
- Span context propagation

### Tooling
- VS Code extension for AEF viewing
- Web-based trace viewer
- Real-time streaming adapter implementations

### Schema Evolution
- v0.2 schema with learnings from v0.1 adoption
- Schema migration tooling

---

## References

- Claude Code logs: `~/.claude/projects/<project>/*.jsonl`
- OpenTelemetry spec: https://opentelemetry.io/docs/specs/
- JSONL spec: https://jsonlines.org/
- UUIDv7 spec: RFC 9562
