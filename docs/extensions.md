# ALF Extension Schemas

This document defines extension schemas for domain-specific agent concepts. Extensions demonstrate how to extend ALF beyond core types while maintaining validation compatibility.

## Extension Design Principles

1. **Namespace Convention**: `<vendor>.<category>.<type>` (minimum 3 segments)
2. **Base Compatibility**: All extensions MUST include base `ALFEntry` fields
3. **Validation Strategy**: Unknown extensions pass validation if base fields are valid
4. **Optional Schemas**: Vendors MAY provide JSON schemas for strict validation

## Reserved Namespaces

| Prefix | Owner | Purpose |
|--------|-------|---------|
| `alf.*` | ALF Project | Official extensions |
| `otel.*` | ALF Project | OpenTelemetry compatibility |
| `warmhub.*` | WarmHub | Belief state, ReAct extensions |
| `langchain.*` | Reserved | Future LangChain adapter |
| `anthropic.*` | Reserved | Future Anthropic extensions |
| `openai.*` | Reserved | Future OpenAI extensions |

---

## warmhub.belief.*

Belief state tracking for hypothesis-driven agents using Dempster-Shafer theory.

### warmhub.belief.query

Captures a belief state query with the current hypothesis snapshot.

**Type**: `warmhub.belief.query`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | The question being evaluated |
| snapshot | object | Yes | Current belief state snapshot |
| snapshot.hypotheses | array | Yes | List of hypotheses |
| snapshot.hypotheses[].id | string | Yes | Hypothesis identifier |
| snapshot.hypotheses[].desc | string | Yes | Human-readable description |
| snapshot.hypotheses[].b | number | Yes | Belief mass [0,1] |
| snapshot.hypotheses[].d | number | Yes | Disbelief mass [0,1] |
| snapshot.hypotheses[].u | number | Yes | Uncertainty mass [0,1] |
| snapshot.assertions | integer | Yes | Number of assertions processed |
| snapshot.finish_ready | boolean | Yes | Whether finish gate is satisfied |
| snapshot.leading | string | No | ID of leading hypothesis |

**Example**:
```json
{
  "v": 1,
  "id": "0194a1b2c3d4-e5f6",
  "ts": 1704067200000,
  "type": "warmhub.belief.query",
  "sid": "session-abc123",
  "seq": 15,
  "query": "What is the capital of France?",
  "snapshot": {
    "hypotheses": [
      { "id": "h1", "desc": "Paris", "b": 0.85, "d": 0.05, "u": 0.10 },
      { "id": "h2", "desc": "Lyon", "b": 0.02, "d": 0.88, "u": 0.10 }
    ],
    "assertions": 5,
    "finish_ready": true,
    "leading": "h1"
  }
}
```

### warmhub.belief.update

Captures a belief state update triggered by new evidence.

**Type**: `warmhub.belief.update`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| assertion | object | Yes | The assertion that triggered the update |
| assertion.id | string | Yes | Assertion identifier |
| assertion.type | string | Yes | Assertion type (evidence, support, refute) |
| assertion.payload | object | Yes | Type-specific assertion data |
| assertion.source | string | Yes | Source of the assertion (tool, model, user) |
| assertion.content | string | No | Human-readable assertion content |
| assertion.consistent_with | array | No | Hypothesis IDs this supports |
| assertion.inconsistent_with | array | No | Hypothesis IDs this refutes |
| deltas | array | No | Belief mass changes per hypothesis |
| deltas[].hyp | string | Yes | Hypothesis ID |
| deltas[].db | number | Yes | Change in belief mass |
| deltas[].dd | number | Yes | Change in disbelief mass |
| deltas[].du | number | Yes | Change in uncertainty mass |
| snapshot_after | object | No | Belief state after update (same schema as query.snapshot) |

**Example**:
```json
{
  "v": 1,
  "id": "0194a1b2c3d5-f7g8",
  "ts": 1704067201000,
  "type": "warmhub.belief.update",
  "sid": "session-abc123",
  "pid": "0194a1b2c3d4-e5f6",
  "seq": 16,
  "assertion": {
    "id": "a5",
    "type": "evidence",
    "payload": { "source": "wikipedia", "confidence": 0.95 },
    "source": "tool:search",
    "content": "Paris is the capital and largest city of France",
    "consistent_with": ["h1"],
    "inconsistent_with": ["h2"]
  },
  "deltas": [
    { "hyp": "h1", "db": 0.10, "dd": 0.00, "du": -0.10 },
    { "hyp": "h2", "db": 0.00, "dd": 0.10, "du": -0.10 }
  ]
}
```

---

## warmhub.react.*

ReAct (Reasoning + Acting) agent step tracking.

### warmhub.react.step

Captures a single ReAct loop iteration with thought, action, and observation.

**Type**: `warmhub.react.step`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| step | integer | Yes | Step number (1-indexed) |
| thought | string | No | Agent's reasoning before acting |
| action | string | Yes | Action taken (tool name or "finish") |
| action_arg | string | No | Argument passed to action |
| observation | string | No | Result of the action |
| latency_ms | integer | No | Time taken for this step |
| tokens | object | No | Token usage for this step |
| tokens.input | integer | Yes | Input tokens consumed |
| tokens.output | integer | Yes | Output tokens generated |

**Example**:
```json
{
  "v": 1,
  "id": "0194a1b2c3d6-h9i0",
  "ts": 1704067202000,
  "type": "warmhub.react.step",
  "sid": "session-abc123",
  "seq": 17,
  "step": 3,
  "thought": "I found that Paris is the capital. Let me verify with another source.",
  "action": "search",
  "action_arg": "France capital city official",
  "observation": "The official capital of the French Republic is Paris...",
  "latency_ms": 1250,
  "tokens": { "input": 512, "output": 128 }
}
```

### warmhub.react.episode

Summary entry for a complete ReAct episode (question → answer).

**Type**: `warmhub.react.episode`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| question_id | string | Yes | Unique identifier for the question |
| question | string | Yes | The question being answered |
| gold_answer | string | Yes | Ground truth answer (for evaluation) |
| predicted_answer | string | No | Agent's predicted answer |
| status | string | Yes | Episode outcome (see values below) |
| metrics | object | Yes | Performance metrics |
| metrics.em | number | Yes | Exact match score [0,1] |
| metrics.f1 | number | Yes | F1 score [0,1] |
| metrics.tool_calls | integer | Yes | Number of tool invocations |
| metrics.total_latency_ms | integer | Yes | Total episode duration |
| metrics.total_tokens | integer | Yes | Total tokens consumed |
| belief_metrics | object | No | Belief-specific metrics (when using belief state) |
| belief_metrics.hypothesis_reversals | integer | Yes | Times leading hypothesis changed |
| belief_metrics.final_confidence | number | Yes | Final belief in predicted answer |
| belief_metrics.uncertainty_reduction | number | Yes | Uncertainty reduced during episode |
| belief_metrics.finish_gate_respected | boolean | Yes | Whether finish gate was satisfied |

**Status values**: `success`, `max_steps`, `error`, `parse_failure`, `timeout`

**Example**:
```json
{
  "v": 1,
  "id": "0194a1b2c3d7-j1k2",
  "ts": 1704067210000,
  "type": "warmhub.react.episode",
  "sid": "session-abc123",
  "seq": 25,
  "question_id": "hotpot_q_12345",
  "question": "What is the capital of France?",
  "gold_answer": "Paris",
  "predicted_answer": "Paris",
  "status": "success",
  "metrics": {
    "em": 1.0,
    "f1": 1.0,
    "tool_calls": 3,
    "total_latency_ms": 8500,
    "total_tokens": 2048
  },
  "belief_metrics": {
    "hypothesis_reversals": 0,
    "final_confidence": 0.95,
    "uncertainty_reduction": 0.85,
    "finish_gate_respected": true
  }
}
```

---

## Creating Custom Extensions

To create your own extension namespace:

1. **Choose a namespace**: Use your organization or project name (e.g., `mycompany.agent.*`)

2. **Define entry types**: Document each type with required and optional fields

3. **Provide examples**: Include valid JSON examples for each type

4. **Optional: JSON Schema**: Create a schema for strict validation

### Extension Template

```markdown
## mycompany.category.*

Brief description of what this extension category captures.

### mycompany.category.typename

Description of this specific entry type.

**Type**: `mycompany.category.typename`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field1 | string | Yes | Description |
| field2 | object | No | Description |

**Example**:
\`\`\`json
{
  "v": 1,
  "id": "...",
  "ts": 1704067200000,
  "type": "mycompany.category.typename",
  "sid": "...",
  "field1": "value",
  "field2": { "nested": "data" }
}
\`\`\`
```

---

## Validation Behavior

| Entry Type | Validation Behavior |
|------------|---------------------|
| Core (`session.*`, `message`, etc.) | Full schema validation |
| Known extension (with schema) | Base fields + extension schema |
| Unknown extension | Base fields only (permissive) |
| Invalid namespace (< 3 segments) | Rejected as invalid |

Extensions enable ALF to grow without requiring core schema changes.
