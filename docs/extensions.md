# AEF Extension Schemas

This document defines how to create extension schemas for domain-specific agent concepts. Extensions demonstrate how to extend AEF beyond core types while maintaining validation compatibility.

## Extension Design Principles

1. **Namespace Convention**: `<vendor>.<category>.<type>` (minimum 3 segments)
2. **Base Compatibility**: All extensions MUST include base `AEFEntry` fields
3. **Validation Strategy**: Unknown extensions pass validation if base fields are valid
4. **Optional Schemas**: Vendors MAY provide JSON schemas for strict validation

## Reserved Namespaces

| Prefix | Owner | Purpose |
|--------|-------|---------|
| `alf.*` | AEF Project | Official extensions |
| `otel.*` | AEF Project | OpenTelemetry compatibility |
| `langchain.*` | Reserved | Future LangChain adapter |
| `anthropic.*` | Reserved | Future Anthropic extensions |
| `openai.*` | Reserved | Future OpenAI extensions |

---

## Creating Custom Extensions

To create your own extension namespace:

1. **Choose a namespace**: Use your organization or project name (e.g., `mycompany.agent.*`)

2. **Define entry types**: Document each type with required and optional fields

3. **Provide examples**: Include valid JSON examples for each type

4. **Optional: JSON Schema**: Create a schema for strict validation

5. **Create a viewer plugin**: See `examples/` for plugin implementation examples

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

## Example Extensions

For working examples of extension implementations, see:

- **WarmHub Plugin** (`examples/warmhub-viewer/`): Belief state tracking and ReAct agent visualization
  - `warmhub.belief.query` - Belief state queries with hypothesis snapshots
  - `warmhub.belief.update` - Belief state updates from assertions
  - `warmhub.react.step` - ReAct agent reasoning steps
  - `warmhub.react.episode` - Episode-level summaries

---

## Validation Behavior

| Entry Type | Validation Behavior |
|------------|---------------------|
| Core (`session.*`, `message`, etc.) | Full schema validation |
| Known extension (with schema) | Base fields + extension schema |
| Unknown extension | Base fields only (permissive) |
| Invalid namespace (< 3 segments) | Rejected as invalid |

Extensions enable AEF to grow without requiring core schema changes.
