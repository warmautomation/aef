# Agent Event Format (AEF) Specification v0.1

## Abstract

AEF is a normalized log format for AI agent traces. It enables cross-framework visualization and analysis by providing a common schema for session, message, tool, and extension events.

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

### 1.3 Terminology

| Term | Definition |
|------|------------|
| Entry | A single line in an AEF file representing one event |
| Session | A logical grouping of entries representing one agent conversation |
| Core Type | A built-in entry type defined by this specification |
| Extension | A namespaced entry type defined by third parties |

## 2. File Format

### 2.1 Encoding

- **Format**: JSONL (newline-delimited JSON)
- **Encoding**: UTF-8 (no BOM)
- **Line Endings**: LF (`\n`) or CRLF (`\r\n`)
- **Compression**: Optional gzip (`.jsonl.gz`)

### 2.2 Structure

Each line MUST be a valid JSON object representing one AEF entry:

```jsonl
{"v":1,"id":"0194a1b2c3d4-e5f6","ts":1704067200000,"type":"session.start","sid":"sess-abc123","agent":"claude-code"}
{"v":1,"id":"0194a1b2c3d5-a1b2","ts":1704067201000,"type":"message","sid":"sess-abc123","role":"user","content":"Hello"}
```

Empty lines SHOULD be ignored by parsers.

### 2.3 Naming Convention

Recommended file naming pattern:
```
<agent>_<session-id>_<timestamp>.aef.jsonl
```

Example: `claude-code_sess-abc123_20240101T120000Z.aef.jsonl`

## 3. Core Schema

### 3.1 Base Entry

Every AEF entry MUST contain these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `v` | integer | Yes | Schema version (currently `1`) |
| `id` | string | Yes | Unique entry ID |
| `ts` | integer | Yes | Unix timestamp in milliseconds |
| `type` | string | Yes | Entry type (see Section 4) |
| `sid` | string | Yes | Session ID - groups related entries |
| `pid` | string | No | Parent ID - for threading/causality |
| `seq` | integer | No | Sequence number within session |

#### 3.1.1 ID Format

Entry IDs SHOULD be:
- Globally unique within a reasonable scope
- Time-ordered for efficient sorting (UUIDv7 or ULID recommended)
- URL-safe (alphanumeric, hyphens, underscores)

Example format: `<timestamp-hex>-<random>` (e.g., `0194a1b2c3d4-e5f6a7b8`)

#### 3.1.2 Timestamp

The `ts` field MUST be:
- Unix epoch time in milliseconds
- Non-negative integer
- Monotonically increasing within a session (SHOULD)

#### 3.1.3 Session ID

The `sid` field:
- Groups all entries belonging to one logical session
- MUST be consistent across all entries in a session
- MAY be human-readable or opaque

#### 3.1.4 Session Boundaries

**Single-session files:**
- SHOULD begin with a `session.start` entry
- SHOULD end with a `session.end` entry
- Missing boundaries are permitted for crash recovery or streaming scenarios

**Multi-session files:**
- AEF files MAY contain multiple sessions (different `sid` values)
- Entries from different sessions MUST NOT be interleaved
- Each session's entries MUST be contiguous (all entries for `sid=A` before any for `sid=B`)
- Each session SHOULD have its own `session.start` and `session.end` entries

**Ordering constraints:**
- `session.start` MUST be the first entry for its session (if present)
- `session.end` MUST be the last entry for its session (if present)
- All other entries MUST appear between `session.start` and `session.end`

**Recovery behavior:**
- Parsers SHOULD handle files missing `session.start` (assume session already in progress)
- Parsers SHOULD handle files missing `session.end` (assume crash or incomplete write)
- Writers MUST flush `session.end` on graceful shutdown

### 3.2 Optional Base Fields

| Field | Type | Description |
|-------|------|-------------|
| `pid` | string | Parent entry ID for causality chains |
| `seq` | integer | 0-indexed sequence number within session |
| `deps` | array | Additional dependency IDs for multi-parent scenarios (see 3.2.3) |

#### 3.2.1 Sequence Number Semantics

The `seq` field provides **logical ordering** within a session. Its meaning varies by entry type:

**Core types:**
- `message`: SHOULD have `seq` tracking chat turn order (0, 1, 2, ...)
- `tool.call`, `tool.result`: SHOULD NOT have `seq` (subordinate to message turns)
- `session.start`, `session.end`, `error`: MAY have `seq` if global ordering is desired

**Extensions:**
- Extensions MAY use `seq` to participate in global ordering alongside messages
- When present, `seq` MUST be monotonically increasing within the session
- Extensions with their own step concepts (e.g., ReAct steps) MAY use `seq` for interleaving with chat history

Example with extensions:
```
seq=0:  user message
seq=1:  assistant message (with tool_use)
        tool.call (no seq)
        tool.result (no seq)
seq=2:  warmhub.react.step (extension participating in ordering)
seq=3:  assistant message (response)
```

This enables visualizers to show a unified timeline of messages and extension events.

#### 3.2.2 Parent ID Semantics

The `pid` field represents **causal dependency** (information flow), not conversation structure:

- An entry's `pid` points to the entry it directly depends on
- For tool execution: `message` → `tool.call` → `tool.result` → `message`
- The final assistant message MUST have `pid` pointing to the `tool.result` it consumes, not the original assistant message that initiated the tool use

This enables visualizers to show both:
1. **Chat history view**: Filter by `seq` to show conversation turns
2. **Execution graph view**: Follow `pid` chains to show causal dependencies

#### 3.2.3 Multi-Result Aggregation

When an assistant message consumes multiple tool results (parallel tool execution):

**Primary `pid`:**
- MUST point to the **last** `tool.result` chronologically (by `ts`)
- This preserves a valid linear chain for simple graph traversal

**Optional `deps` field:**
- MAY include a `deps` array listing all consumed `tool.result` IDs
- Enables full dependency graph reconstruction for multi-tool scenarios

Example with parallel tools:
```
message (seq=1) invokes tools A and B in parallel
  ├── tool.call A → tool.result A (id: "res-A", ts: 1000)
  └── tool.call B → tool.result B (id: "res-B", ts: 1050)

message (seq=2) summarizes both results:
  pid: "res-B"           // last chronologically
  deps: ["res-A", "res-B"]  // full dependency set (optional)
```

Consumers requiring full causality SHOULD use `deps` when present, falling back to `pid` for linear chains.

## 4. Core Entry Types

### 4.1 session.start

Marks the beginning of an agent session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"session.start"` |
| `agent` | string | Yes | Agent identifier (e.g., `"claude-code"`) |
| `version` | string | No | Agent version |
| `workspace` | string | No | Working directory or workspace path |
| `model` | string | No | LLM model identifier |
| `meta` | object | No | Additional metadata |

Example:
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-e5f6",
  "ts": 1704067200000,
  "type": "session.start",
  "sid": "sess-abc123",
  "agent": "claude-code",
  "version": "1.0.0",
  "workspace": "/home/user/project",
  "model": "claude-3-opus"
}
```

### 4.2 session.end

Marks the end of an agent session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"session.end"` |
| `status` | string | Yes | `"complete"`, `"error"`, `"timeout"`, or `"user_abort"` |
| `summary` | object | No | Session statistics |

Summary object:

| Field | Type | Description |
|-------|------|-------------|
| `messages` | integer | Total message count |
| `tool_calls` | integer | Total tool invocations |
| `duration_ms` | integer | Session duration in milliseconds |
| `tokens` | object | Token usage (`{input, output}`) |

Example:
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-f7g8",
  "ts": 1704067500000,
  "type": "session.end",
  "sid": "sess-abc123",
  "status": "complete",
  "summary": {
    "messages": 12,
    "tool_calls": 5,
    "duration_ms": 300000,
    "tokens": { "input": 5000, "output": 2000 }
  }
}
```

### 4.3 message

A user, assistant, or system message.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"message"` |
| `role` | string | Yes | `"user"`, `"assistant"`, or `"system"` |
| `content` | string \| array | Yes | Message content (text or content blocks) |
| `model` | string | No | Model used (overrides `session.model` for multi-model sessions) |
| `tokens` | object | No | Token counts for this message |

Content blocks (when content is an array):

| Block Type | Fields | Description |
|------------|--------|-------------|
| `text` | `{type: "text", text: string}` | Text content |
| `tool_use` | `{type: "tool_use", id, name, input}` | Tool invocation |
| `tool_result` | `{type: "tool_result", tool_use_id, content, is_error?}` | Tool result |

Example (simple text):
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-a1b2",
  "ts": 1704067201000,
  "type": "message",
  "sid": "sess-abc123",
  "role": "user",
  "content": "What files are in this directory?"
}
```

Example (with content blocks):
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-c3d4",
  "ts": 1704067202000,
  "type": "message",
  "sid": "sess-abc123",
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me check the directory contents." },
    { "type": "tool_use", "id": "tool-1", "name": "Bash", "input": { "command": "ls -la" } }
  ]
}
```

### 4.4 tool.call

A tool invocation event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"tool.call"` |
| `tool` | string | Yes | Tool name |
| `args` | object | Yes | Tool arguments |
| `call_id` | string | Conditional | ID for correlating with `tool.result` (see below) |

**`call_id` requirements:**
- MUST be present when the `tool.call` corresponds to a `tool_use` content block in a message
- MUST match the `id` field from the corresponding `tool_use` block
- MUST be present when multiple tool calls originate from the same parent message
- MAY be omitted for standalone tool invocations not originating from LLM output

Adapters SHOULD always include `call_id` when converting from API formats that provide tool use IDs.

#### Correlation: `call_id` vs `pid`

Both `call_id` and `pid` can correlate tool calls with results, but serve different purposes:

- **`pid`** (parent ID): Provides causal ordering. The `tool.result` entry's `pid` points to its `tool.call`. Use for building execution graphs.
- **`call_id`**: Provides direct correlation by shared ID. Use for parallel tool execution where multiple tool calls occur in a single message turn.

When a single assistant message invokes multiple tools in parallel:
```
message (seq=1) contains: tool_use[id=A], tool_use[id=B]
  ├── tool.call (call_id=A, pid=message)
  │     └── tool.result (call_id=A, pid=tool.call-A)
  └── tool.call (call_id=B, pid=message)
        └── tool.result (call_id=B, pid=tool.call-B)
```

The `call_id` disambiguates which result belongs to which call when they share the same parent message.

Example:
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-d5e6",
  "ts": 1704067203000,
  "type": "tool.call",
  "sid": "sess-abc123",
  "pid": "0194a1b2c3d4-c3d4",
  "tool": "Bash",
  "args": { "command": "ls -la" },
  "call_id": "tool-1"
}
```

### 4.5 tool.result

A tool execution result.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"tool.result"` |
| `tool` | string | Yes | Tool name |
| `success` | boolean | Yes | Whether execution succeeded |
| `result` | any | Conditional | Tool output (see below) |
| `call_id` | string | Conditional | Correlates with `tool.call` (MUST match if `tool.call` has `call_id`) |
| `duration_ms` | integer | No | Execution time in milliseconds |
| `error` | object | Conditional | Error details (see below) |

**Output requirements:**
- When `success: true`: `result` SHOULD be present (MAY be omitted for side-effect-only tools)
- When `success: false`: `error` MUST be present with at least a `message` field
- Both `result` and `error` MAY be present (e.g., partial results before failure)

Error object:

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Error code (recommended for programmatic handling) |
| `message` | string | Human-readable error message (REQUIRED when error present) |

Example:
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-e7f8",
  "ts": 1704067204000,
  "type": "tool.result",
  "sid": "sess-abc123",
  "pid": "0194a1b2c3d4-d5e6",
  "tool": "Bash",
  "call_id": "tool-1",
  "success": true,
  "result": "total 24\ndrwxr-xr-x  5 user user 160 Jan  1 12:00 .\n...",
  "duration_ms": 50
}
```

### 4.6 error

An error event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"error"` |
| `message` | string | Yes | Error message |
| `code` | string | No | Error code |
| `stack` | string | No | Stack trace |
| `recoverable` | boolean | No | Whether the error is recoverable |

Example:
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-g9h0",
  "ts": 1704067250000,
  "type": "error",
  "sid": "sess-abc123",
  "code": "RATE_LIMIT",
  "message": "API rate limit exceeded",
  "recoverable": true
}
```

## 5. Extensions

### 5.1 Namespace Convention

Extensions use dotted namespaces following the pattern:
```
<vendor>.<category>.<type>
```

Examples:
- `warmhub.belief.query` - Belief state query
- `warmhub.react.step` - ReAct agent step
- `langchain.chain.start` - LangChain chain execution

### 5.2 Reserved Prefixes

| Prefix | Owner |
|--------|-------|
| `alf.*` | Official AEF extensions |
| `otel.*` | OpenTelemetry compatibility |

### 5.3 Extension Validation

Extension entries:
- MUST include all base entry fields (v, id, ts, type, sid)
- MUST have a type matching the namespace pattern
- MAY include any additional fields
- SHOULD be documented for interoperability

Example extension entry:
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-ext1",
  "ts": 1704067205000,
  "type": "warmhub.belief.query",
  "sid": "sess-abc123",
  "query": "What is the capital of France?",
  "snapshot": {
    "hypotheses": [
      { "id": "h1", "text": "Paris", "belief": 0.95, "disbelief": 0.02, "uncertainty": 0.03 }
    ],
    "assertions": 5,
    "finish_ready": true,
    "leading": "h1"
  }
}
```

## 6. OpenTelemetry Mapping

AEF concepts map to OpenTelemetry as follows:

| AEF Concept | OTel Equivalent |
|-------------|-----------------|
| `sid` (session) | Trace ID |
| `id` (entry) | Span ID |
| `pid` (parent) | Parent Span ID |
| `deps` (multi-parent) | Span Links |
| `tool.call` + `tool.result` | Span (kind=CLIENT) |
| `message` | Event / Log |
| Extension fields | Span Attributes |

### 6.1 Trace Context

When converting AEF to OTel:
- Session ID becomes Trace ID (may require hashing for format compliance)
- Entry ID becomes Span ID
- Parent ID provides span hierarchy
- Tool call/result pairs form client spans

### 6.2 Future Exporter

A future `alf export --format otlp` command will:
- Convert sessions to traces
- Convert tool pairs to spans
- Preserve metadata as span attributes
- Support OTel collector ingestion

## Appendix A: JSON Schema

The authoritative JSON Schema for AEF core types is maintained at:
`src/schema/core.schema.json`

Validators SHOULD use this schema for validation.

## Appendix B: Complete Example

A complete session with all entry types:

```jsonl
{"v":1,"id":"0194a1b2c3d4-0001","ts":1704067200000,"type":"session.start","sid":"demo-session","agent":"claude-code","version":"1.0.0","model":"claude-3-opus"}
{"v":1,"id":"0194a1b2c3d4-0002","ts":1704067201000,"type":"message","sid":"demo-session","seq":0,"role":"user","content":"List the files in the current directory"}
{"v":1,"id":"0194a1b2c3d4-0003","ts":1704067202000,"type":"message","sid":"demo-session","seq":1,"pid":"0194a1b2c3d4-0002","role":"assistant","content":[{"type":"text","text":"I'll list the files for you."},{"type":"tool_use","id":"call-1","name":"Bash","input":{"command":"ls -la"}}]}
{"v":1,"id":"0194a1b2c3d4-0004","ts":1704067203000,"type":"tool.call","sid":"demo-session","pid":"0194a1b2c3d4-0003","tool":"Bash","args":{"command":"ls -la"},"call_id":"call-1"}
{"v":1,"id":"0194a1b2c3d4-0005","ts":1704067204000,"type":"tool.result","sid":"demo-session","pid":"0194a1b2c3d4-0004","tool":"Bash","call_id":"call-1","success":true,"result":"total 16\n-rw-r--r-- 1 user user 1234 Jan 1 12:00 README.md\n-rw-r--r-- 1 user user 5678 Jan 1 12:00 package.json","duration_ms":45}
{"v":1,"id":"0194a1b2c3d4-0006","ts":1704067205000,"type":"message","sid":"demo-session","seq":2,"pid":"0194a1b2c3d4-0005","role":"assistant","content":"The directory contains:\n- README.md (1234 bytes)\n- package.json (5678 bytes)"}
{"v":1,"id":"0194a1b2c3d4-0007","ts":1704067206000,"type":"session.end","sid":"demo-session","status":"complete","summary":{"messages":3,"tool_calls":1,"duration_ms":6000,"tokens":{"input":150,"output":75}}}
```

## Appendix C: Implementation Notes

### C.1 Intent vs Execution (Data Duplication)

AEF intentionally duplicates tool arguments in two places:

1. **`message` content blocks** (`tool_use.input`): Captures the LLM's *intent* - what the model generated
2. **`tool.call` entry** (`args`): Captures the *execution* - what the system actually ran

This duplication serves important purposes:

- **Audit trail**: Arguments may be sanitized, validated, or transformed between intent and execution
- **Debugging**: Mismatches between intent and execution reveal system issues
- **Replay**: Either view can be reconstructed independently

Adapters SHOULD emit both entries even when the data is identical. Consumers concerned about storage can deduplicate by comparing `tool_use.id` with `tool.call.call_id`.

### C.2 Parsing

Parsers SHOULD:
- Ignore empty lines
- Ignore lines that fail JSON parsing (with warning)
- Support streaming (line-by-line) processing
- Handle unknown entry types gracefully

### C.3 Writing

Writers SHOULD:
- Output one entry per line
- Use compact JSON (no pretty-printing)
- Flush after each entry for real-time streaming
- Use monotonically increasing timestamps

### C.4 Validation

Validators SHOULD:
- Validate base fields for all entries
- Apply type-specific schemas for core types
- Pass extension entries with valid base fields
- Report validation errors with line numbers

## Changelog

### v0.1 (Draft)
- Initial specification
- Core types: session.start, session.end, message, tool.call, tool.result, error
- Extension namespace convention
- OpenTelemetry mapping documentation
